import { Logger } from '@idol-bbq-utils/log'
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

            const job = new CronJob(cron, async () => {
                await this.dispatchToQueue(sender)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(sender)}`)
            this.cronJobs.push(job)
        }
    }

    private async dispatchToQueue(sender: TaskSender): Promise<void> {
        const websites = sender.websites
        const cron = sender.config.cfg_sender.cron
        // 统一生成 12 位短 jobId
        const jobId = generateJobId('sender', `${sender.name}:${websites.join(',')}`, cron)

        const lockKey = getLockKey('sender', sender.name || 'unnamed')
        const redis = this.queue_manager.getConnection()

        const acquired = await acquireLock(redis, lockKey, jobId, 60)
        if (!acquired) {
            this.log?.debug(`Lock not acquired for ${sender.name}, another scheduler is processing`, {
                trace_id: jobId,
            })
            return
        }

        try {
            const task_type = sender.task_type
            if (task_type == 'article') {
                const article_ids = await DB.SendBy.queryPendingArticleIds(
                    websites,
                    sender.targets.map((t) => t.id),
                )

                if (article_ids.length === 0) {
                    this.log?.debug(`No pending articles for ${sender.name || 'unnamed'}`, { trace_id: jobId })
                    return
                }
            }

            const jobData: SenderJobData = {
                type: 'sender',
                task_id: jobId,
                task_type: sender.task_type,
                task_title: sender.task_title,
                name: sender.name || '',
                websites,
                targets: sender.targets,
                config: sender.config,
            }

            const senderQueue = this.queue_manager.getQueue(QueueName.SENDER)
            await senderQueue.add('sender', jobData, {
                jobId,
            })

            this.log?.info(
                `Dispatched ${task_type == 'article' ? 'article task' : 'follows task'} to sender queue: ${sender.name}`,
                { trace_id: jobId },
            )
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
        // scheduler-service does not need this method
    }

    finishTask(_params: { taskId: string; result: any; immediate_notify?: boolean }) {
        // scheduler-service does not need this method
    }
}

export { SenderTaskScheduler }
