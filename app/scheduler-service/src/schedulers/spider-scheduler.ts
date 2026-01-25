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
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`[${taskId}] Starting to dispatch task: ${crawler.name}`)

                await this.dispatchToQueue(taskId, crawler)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(crawler)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(taskId: string, crawler: TaskCrawler): Promise<void> {
        if (!this.queueManager) return

        const lockKey = getLockKey('crawler', crawler.name || 'unnamed')
        const redis = this.queueManager.getConnection()

        const acquired = await acquireLock(redis, lockKey, taskId, 60)
        if (!acquired) {
            this.log?.debug(`[${taskId}] Lock not acquired for ${crawler.name}, another scheduler is processing`)
            return
        }

        try {
            const jobId = generateJobId('crawler', `${crawler.name}:${crawler.websites.join(',')}`, crawler.config.cron)

            const jobData: CrawlerJobData = {
                type: 'crawler',
                task_id: taskId,
                task_type: crawler.task_type,
                name: crawler.name || '',
                websites: crawler.websites,
                config: crawler.config,
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
