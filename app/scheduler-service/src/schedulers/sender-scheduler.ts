import { Logger } from '@idol-bbq-utils/log'
import { spiderRegistry } from '@idol-bbq-utils/spider'
import { CronJob } from 'cron'
import { TaskScheduler } from '../utils/base'
import type { AppConfig, QueueConfig, TaskSender } from '@idol-bbq-utils/config'
import DB from '@idol-bbq-utils/db'
import { QueueManager, QueueName, generateJobId, getLockKey, acquireLock, releaseLock } from '@idol-bbq-utils/queue'
import type { SenderJobData } from '@idol-bbq-utils/queue/jobs'
import type { Ctx } from '@/types'

class SenderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'SenderTaskScheduler'
    protected log?: Logger
    private app_config: AppConfig
    private queue_manager: QueueManager

    constructor(ctx: Ctx, queue_config: QueueConfig) {
        super()
        this.app_config = ctx.app_config
        this.log = ctx.logger?.child({ subservice: this.NAME })
        this.queue_manager = new QueueManager({
            redis: queue_config?.redis || { host: 'redis', port: 6379 },
        })
    }

    async init() {
        this.log?.info('initializing...')

        const senders = this.app_config.getTaskSenders()
        if (!senders || senders.length === 0) {
            this.log?.warn('Sender not found, skipping...')
            return
        }

        for (const sender of senders) {
            const cron = sender.config.cfg_sender.cron
            const { name } = sender
            const { task_title } = sender.config?.cfg_task || {}

            const job = new CronJob(cron, async () => {
                const task_id = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`starting to dispatch task ${[name, task_title].filter(Boolean).join(' ')}...`)

                await this.dispatchToQueue(task_id, sender)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(sender)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(task_id: string, sender: TaskSender): Promise<void> {
        const lockKey = getLockKey('sender', sender.name || 'unnamed')
        const redis = this.queue_manager.getConnection()

        const acquired = await acquireLock(redis, lockKey, task_id, 60)
        if (!acquired) {
            this.log?.debug(`[${task_id}] Lock not acquired for ${sender.name}, another scheduler is processing`)
            return
        }
        const websites = sender.websites
        try {
            const task_type = sender.task_type
            // check pending articles for 'article' task type
            if (task_type == 'article') {
                const article_ids = await this.queryPendingArticleIds(websites, sender)

                if (article_ids.length === 0) {
                    this.log?.debug(`[${task_id}] No pending articles for ${sender.name || 'unnamed'}`)
                    return
                }
            }

            const jobId = generateJobId('sender', `${sender.name}:${websites.join(',')}`, sender.config.cfg_sender.cron)

            const jobData: SenderJobData = {
                type: 'sender',
                task_id,
                task_type: sender.task_type,
                task_title: sender.task_title,
                name: sender.name || '',
                websites,
                targets: sender.targets,
                config: sender.config
            }

            const senderQueue = this.queue_manager.getQueue(QueueName.SENDER)
            await senderQueue.add('sender', jobData, {
                jobId,
            })

            this.log?.info(
                `[${task_id}] Dispatched ${task_type == 'article' ? 'article task' : 'follows task'} to sender queue: ${sender.name} (jobId: ${jobId.substring(0, 8)}...)`,
            )
        } finally {
            await releaseLock(redis, lockKey, task_id)
        }
    }

    private async queryPendingArticleIds(websites: string[], sender: TaskSender): Promise<number[]> {
        const articleIdsSet: Set<number> = new Set()
        const targets = sender.targets?.map((s) => s.id) ?? []

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
        await this.queue_manager.close()
        this.log?.info('Queue manager closed')
        this.log?.info('Manager dropped')
    }

    updateTaskStatus(_params: { taskId: string; status: TaskScheduler.TaskStatus }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }

    finishTask(_params: { taskId: string; result: any; immediate_notify?: boolean }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }
}

export { SenderTaskScheduler as ForwarderTaskScheduler }
