import { Logger } from '@idol-bbq-utils/log'
import { CronJob } from 'cron'
import { TaskScheduler } from '../utils/base'
import { QueueManager, QueueName, generateJobId, getLockKey, acquireLock, releaseLock } from '@idol-bbq-utils/queue'
import type { CrawlerJobData } from '@idol-bbq-utils/queue/jobs'
import type { Ctx } from '@/types'
import type { AppConfig, QueueConfig, TaskCrawler } from '@idol-bbq-utils/config'

class SpiderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'SpiderTaskScheduler'
    protected log?: Logger
    private app_config: AppConfig
    private queueManager: QueueManager

    constructor(ctx: Ctx, queueConfig: QueueConfig) {
        super()
        this.app_config = ctx.app_config
        this.log = ctx.logger?.child({ subservice: this.NAME })

        this.queueManager = new QueueManager({
            redis: queueConfig.redis,
        })
        this.log?.info('Queue mode enabled')
    }

    async init() {
        this.log?.info('Manager initializing...')

        const crawlers = this.app_config.getTaskCrawlers()
        if (!crawlers || crawlers.length === 0) {
            this.log?.warn('Crawler not found, skipping...')
            return
        }

        for (const crawler of crawlers) {
            const cron = crawler.config.cron

            const job = new CronJob(cron, async () => {
                await this.dispatchToQueue(crawler)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(crawler)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(crawler: TaskCrawler): Promise<void> {
        if (!this.queueManager) return

        const cron = crawler.config.cron
        // 统一使用 12 位短 jobId 作为业务标识和队列 ID
        const jobId = generateJobId('crawler', `${crawler.name}:${crawler.websites.join(',')}`, cron)
        const lockKey = getLockKey('crawler', crawler.name || 'unnamed')
        const redis = this.queueManager.getConnection()

        // 锁的标识也使用 jobId，确保同一时间窗口内只有一次执行
        const acquired = await acquireLock(redis, lockKey, jobId, 60)
        if (!acquired) {
            this.log?.debug(`Lock not acquired for ${crawler.name}, another scheduler is processing`, {
                trace_id: jobId,
            })
            return
        }

        try {
            this.log?.info(`Starting to dispatch task: ${crawler.name}`, { trace_id: jobId })

            const jobData: CrawlerJobData = {
                type: 'crawler',
                task_id: jobId,
                task_type: crawler.task_type,
                name: crawler.name || '',
                websites: crawler.websites,
                config: crawler.config,
            }

            const crawlerQueue = this.queueManager.getQueue(QueueName.CRAWLER)
            await crawlerQueue.add('crawl', jobData, {
                jobId,
            })

            this.log?.info(`Task dispatched to queue: ${crawler.name}`, {
                trace_id: jobId,
            })
        } finally {
            await releaseLock(redis, lockKey, jobId)
        }
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
    }

    updateTaskStatus(_params: { taskId: string; status: TaskScheduler.TaskStatus }) {
        // scheduler-service does not need this method
    }

    finishTask(_params: { taskId: string; result: any; immediate_notify?: boolean }) {
        // scheduler-service does not need this method
    }
}

export { SpiderTaskScheduler }
