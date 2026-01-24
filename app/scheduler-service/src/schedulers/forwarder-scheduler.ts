import { Logger } from '@idol-bbq-utils/log'
import { spiderRegistry } from '@idol-bbq-utils/spider'
import { CronJob } from 'cron'
import EventEmitter from 'events'
import { sanitizeWebsites, TaskScheduler } from '../utils/base'
import type { AppConfig, QueueModeConfig } from '../types'
import type { TaskType } from '@idol-bbq-utils/spider/types'
import DB from '@idol-bbq-utils/db'
import type { Forwarder } from '../types/forwarder'
import crypto from 'crypto'
import { QueueManager, QueueName, generateJobId, getLockKey, acquireLock, releaseLock } from '@idol-bbq-utils/queue'
import type { ForwarderJobData } from '@idol-bbq-utils/queue/jobs'
import { MediaToolEnum } from '../types/media'

class ForwarderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'ForwarderTaskScheduler'
    protected log?: Logger
    private props: Pick<AppConfig, 'cfg_forwarder' | 'forwarders' | 'forward_targets'>
    private queueManager?: QueueManager
    private useQueueMode: boolean = false

    constructor(
        props: Pick<AppConfig, 'cfg_forwarder' | 'forwarders' | 'forward_targets'>,
        emitter: EventEmitter,
        log?: Logger,
        queueConfig?: QueueModeConfig,
    ) {
        super(emitter)
        this.log = log?.child({ subservice: this.NAME })
        this.props = props

        if (queueConfig?.enabled) {
            this.useQueueMode = true
            this.queueManager = new QueueManager({
                redis: queueConfig.redis,
            })
            this.log?.info('Queue mode enabled')
        }
    }

    async init() {
        this.log?.info('initializing...')

        if (!this.props.forwarders) {
            this.log?.warn('Forwarder not found, skipping...')
            return
        }

        if (!this.useQueueMode) {
            this.log?.error('ForwarderTaskScheduler requires queue mode to be enabled')
            throw new Error('Queue mode must be enabled for scheduler-service')
        }

        for (const forwarder of this.props.forwarders) {
            forwarder.cfg_forwarder = {
                cron: '*/30 * * * *',
                media: {
                    type: 'no-storage',
                    use: {
                        tool: MediaToolEnum.DEFAULT,
                    },
                },
                ...this.props.cfg_forwarder,
                ...forwarder.cfg_forwarder,
            }
            const { cron } = forwarder.cfg_forwarder
            const { task_title, name } = forwarder
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`starting to dispatch task ${[name, task_title].filter(Boolean).join(' ')}...`)

                if (this.useQueueMode && this.queueManager) {
                    await this.dispatchToQueue(taskId, forwarder)
                }
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(forwarder)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(taskId: string, forwarder: Forwarder<TaskType>): Promise<void> {
        if (!this.queueManager) return

        const websites = sanitizeWebsites({
            websites: forwarder.websites,
            origin: forwarder.origin,
            paths: forwarder.paths,
        })

        const lockKey = getLockKey('forwarder', forwarder.name || 'unnamed')
        const redis = this.queueManager.getConnection()

        const acquired = await acquireLock(redis, lockKey, taskId, 60)
        if (!acquired) {
            this.log?.debug(`[${taskId}] Lock not acquired for ${forwarder.name}, another scheduler is processing`)
            return
        }

        try {
            const articleIds = await this.queryPendingArticleIds(websites, forwarder)

            if (articleIds.length === 0) {
                this.log?.debug(`[${taskId}] No pending articles for ${forwarder.name || 'unnamed'}`)
                return
            }

            const jobId = generateJobId(
                'forwarder',
                `${forwarder.name}:${websites.join(',')}`,
                forwarder.cfg_forwarder?.cron,
            )

            const media = forwarder.cfg_forwarder?.media

            const targets = (forwarder.subscribers
                ?.map((s: string | { id: string; cfg_forward_target?: any }) => {
                    const targetId = typeof s === 'string' ? s : s.id
                    const runtimeConfig = typeof s === 'object' ? s.cfg_forward_target : undefined

                    const targetConfig = this.props.forward_targets?.find(
                        (t) =>
                            (t.id ||
                                `${t.platform}-${crypto.createHash('md5').update(JSON.stringify(t)).digest('hex')}`) ===
                            targetId,
                    )

                    if (!targetConfig) {
                        this.log?.warn(`Target ${targetId} not found in forward_targets config`)
                        return null
                    }

                    return {
                        id: targetId,
                        platform: targetConfig.platform,
                        cfg_platform: targetConfig.cfg_platform,
                        runtime_config: runtimeConfig,
                    }
                })
                .filter((t: any) => t !== null) ?? []) as import('@idol-bbq-utils/queue/jobs').ForwarderTarget[]

            const taskType = forwarder.task_type || 'article'

            const jobData: ForwarderJobData = {
                type: 'forwarder',
                taskId,
                storageTaskId: taskId,
                taskType,
                articleIds: taskType === 'article' ? articleIds : undefined,
                urls: websites,
                forwarderConfig: {
                    targets,
                    renderType: forwarder.cfg_forwarder?.render_type,
                    media: media
                        ? {
                              type: media.type,
                              use: media.use
                                  ? {
                                        tool: media.use.tool,
                                        path: 'path' in media.use ? media.use.path : undefined,
                                        cookieFile: 'cookie_file' in media.use ? media.use.cookie_file : undefined,
                                    }
                                  : undefined,
                          }
                        : undefined,
                },
                followsConfig:
                    taskType === 'follows'
                        ? {
                              taskTitle: forwarder.task_title,
                              comparisonWindow: (forwarder.cfg_task as any)?.comparison_window || '1d',
                          }
                        : undefined,
            }

            const forwarderQueue = this.queueManager.getQueue(QueueName.FORWARDER)
            await forwarderQueue.add('forward', jobData, {
                jobId,
            })

            this.log?.info(
                `[${taskId}] Dispatched ${articleIds.length} articles to forwarder queue: ${forwarder.name} (jobId: ${jobId.substring(0, 8)}...)`,
            )
        } finally {
            await releaseLock(redis, lockKey, taskId)
        }
    }

    private async queryPendingArticleIds(websites: string[], forwarder: Forwarder<TaskType>): Promise<number[]> {
        const articleIdsSet: Set<number> = new Set()
        const targets = forwarder.subscribers?.map((s) => (typeof s === 'string' ? s : s.id)) ?? []

        for (const website of websites) {
            const { u_id, platform } = spiderRegistry.extractBasicInfo(website) ?? {}
            if (!u_id || !platform) continue

            const articles = await DB.Article.getArticlesByName(u_id, platform)
            if (articles.length === 0) continue

            const articleIdList = articles.map((a) => a.id)

            const forwardedRecords = await DB.ForwardBy.batchCheckExist(articleIdList, targets, 'article')

            const forwardedMap = new Map<number, Set<string>>()
            for (const record of forwardedRecords) {
                if (!forwardedMap.has(record.ref_id)) {
                    forwardedMap.set(record.ref_id, new Set())
                }
                forwardedMap.get(record.ref_id)!.add(record.bot_id)
            }

            for (const article of articles) {
                const forwardedTargets = forwardedMap.get(article.id) || new Set()
                const needsForwarding = targets.some((t) => !forwardedTargets.has(t))
                if (needsForwarding) {
                    articleIdsSet.add(article.id)
                }
            }
        }

        return Array.from(articleIdsSet)
    }

    async start() {
        this.log?.info('Manager starting...')
        this.cronJobs.forEach((job) => {
            job.start()
        })
    }

    async stop() {
        this.cronJobs.forEach((job) => {
            job.stop()
        })
        this.log?.info('All jobs stopped')
        this.log?.info('Manager stopped')
    }

    async drop() {
        this.tasks.clear()
        if (this.queueManager) {
            await this.queueManager.close()
            this.log?.info('Queue manager closed')
        }
        this.log?.info('Manager dropped')
    }

    updateTaskStatus(_params: { taskId: string; status: TaskScheduler.TaskStatus }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }

    finishTask(_params: { taskId: string; result: any; immediate_notify?: boolean }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }
}

export { ForwarderTaskScheduler }
