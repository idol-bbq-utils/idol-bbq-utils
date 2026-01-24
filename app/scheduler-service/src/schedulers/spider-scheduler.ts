import { Logger } from '@idol-bbq-utils/log'
import { CronJob } from 'cron'
import EventEmitter from 'events'
import { sanitizeWebsites, TaskScheduler } from '../utils/base'
import type { Crawler } from '../types/crawler'
import type { AppConfig, QueueModeConfig } from '../types'
import { QueueManager, QueueName, generateJobId, getLockKey, acquireLock, releaseLock } from '@idol-bbq-utils/queue'
import type { CrawlerJobData } from '@idol-bbq-utils/queue/jobs'

/**
 * 根据cronjob dispatch爬虫任务到队列
 * 仅负责调度，不执行实际爬取
 */
class SpiderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'SpiderTaskScheduler'
    protected log?: Logger
    private props: Pick<AppConfig, 'crawlers' | 'cfg_crawler'>
    private queueManager?: QueueManager
    private useQueueMode: boolean = false

    constructor(
        props: Pick<AppConfig, 'crawlers' | 'cfg_crawler'>,
        emitter: EventEmitter,
        log?: Logger,
        queueConfig?: QueueModeConfig,
    ) {
        super(emitter)
        this.props = props
        this.log = log?.child({ subservice: this.NAME })

        if (queueConfig?.enabled) {
            this.useQueueMode = true
            this.queueManager = new QueueManager({
                redis: queueConfig.redis,
            })
            this.log?.info('Queue mode enabled')
        }
    }

    async init() {
        this.log?.info('Manager initializing...')

        if (!this.props.crawlers) {
            this.log?.warn('Crawler not found, skipping...')
            return
        }

        // scheduler-service 只支持队列模式，不需要EventEmitter handlers
        if (!this.useQueueMode) {
            this.log?.error('SpiderTaskScheduler requires queue mode to be enabled')
            throw new Error('Queue mode must be enabled for scheduler-service')
        }

        for (const crawler of this.props.crawlers) {
            crawler.cfg_crawler = {
                cron: '*/30 * * * *',
                ...this.props.cfg_crawler,
                ...crawler.cfg_crawler,
            }
            let { cron } = crawler.cfg_crawler
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`[${taskId}] Starting to dispatch task: ${crawler.name}`)

                if (this.useQueueMode && this.queueManager) {
                    await this.dispatchToQueue(taskId, crawler)
                }
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(crawler)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(taskId: string, crawler: Crawler): Promise<void> {
        if (!this.queueManager) return

        const websites = sanitizeWebsites({
            websites: crawler.websites,
            origin: crawler.origin,
            paths: crawler.paths,
        })

        const lockKey = getLockKey('crawler', crawler.name || 'unnamed')
        const redis = this.queueManager.getConnection()

        const acquired = await acquireLock(redis, lockKey, taskId, 60)
        if (!acquired) {
            this.log?.debug(`[${taskId}] Lock not acquired for ${crawler.name}, another scheduler is processing`)
            return
        }

        try {
            const jobId = generateJobId('crawler', `${crawler.name}:${websites.join(',')}`, crawler.cfg_crawler?.cron)

            const jobData: CrawlerJobData = {
                type: 'crawler',
                taskId,
                crawlerName: crawler.name || 'unnamed',
                websites,
                taskType: crawler.task_type || 'article',
                config: {
                    engine: crawler.cfg_crawler?.engine,
                    cookieFile: crawler.cfg_crawler?.cookie_file,
                    translator: crawler.cfg_crawler?.translator
                        ? {
                              provider: crawler.cfg_crawler.translator.provider,
                              apiKey: crawler.cfg_crawler.translator.api_key || '',
                              config: crawler.cfg_crawler.translator.cfg_translator as Record<string, unknown> | undefined,
                          }
                        : undefined,
                    intervalTime: crawler.cfg_crawler?.interval_time,
                    userAgent: crawler.cfg_crawler?.user_agent,
                    subTaskType: crawler.cfg_crawler?.sub_task_type,
                },
            }

            const crawlerQueue = this.queueManager.getQueue(QueueName.CRAWLER)
            await crawlerQueue.add('crawl', jobData, {
                jobId,
            })

            this.log?.info(`[${taskId}] Task dispatched to queue: ${crawler.name} (jobId: ${jobId.substring(0, 8)}...)`)
        } finally {
            await releaseLock(redis, lockKey, taskId)
        }
    }

    /**
     * 启动爬虫调度器
     */
    async start() {
        this.log?.info('Manager starting...')
        this.cronJobs.forEach((job) => {
            job.start()
        })
    }

    /**
     * 停止爬虫调度器
     */
    async stop() {
        this.cronJobs.forEach((job) => {
            job.stop()
            this.log?.info(`Task dispatcher stopped with cron: ${job.cronTime.source}`)
        })
        this.log?.info('Manager stopped')
    }

    async drop() {
        this.tasks.clear()
        if (this.queueManager) {
            await this.queueManager.close()
            this.log?.info('Queue manager closed')
        }
        this.log?.info('Spider Manager dropped')
    }

    updateTaskStatus(_params: { taskId: string; status: TaskScheduler.TaskStatus }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }

    finishTask(_params: { taskId: string; result: any; immediate_notify?: boolean }) {
        // scheduler-service 不需要此方法，仅用于EventEmitter模式
    }
}

export { SpiderTaskScheduler }
