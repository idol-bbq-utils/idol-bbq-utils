import { log } from './config'
import { AppConfig, parseConfigFromFile } from '@idol-bbq-utils/config'
import { SpiderTaskScheduler } from './schedulers/spider-scheduler'
import { SenderTaskScheduler } from './schedulers/sender-scheduler'
import { ensureMigrations } from '@idol-bbq-utils/db'
import { QueueManager } from '@idol-bbq-utils/queue'
import { startSenderWorker } from './workers/sender'
import type { Ctx } from './types'

async function main() {
    await ensureMigrations()

    const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER !== 'false'
    const ENABLE_SENDER_WORKER = process.env.ENABLE_SENDER_WORKER !== 'false'

    log.info('Scheduler service initializing...')
    log.info(`Mode: Scheduler=${ENABLE_SCHEDULER}, ForwarderWorker=${ENABLE_SENDER_WORKER}`)

    if (!ENABLE_SCHEDULER && !ENABLE_SENDER_WORKER) {
        log.error('Both ENABLE_SCHEDULER and ENABLE_SENDER_WORKER are disabled. At least one must be enabled.')
        process.exit(1)
    }

    const config = parseConfigFromFile('./config.yaml')
    if (!config) {
        log.error('Config file is empty or invalid, exiting...')
        return
    }

    const app_config = new AppConfig(config, log)

    await app_config.syncAccounts();

    const queue_config = {
        enabled: true,
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
    }

    log.debug(`Redis: ${queue_config.redis.host}:${queue_config.redis.port}`)

    const queueManager = new QueueManager({ redis: queue_config.redis })
    const workers: Array<ReturnType<typeof startSenderWorker>> = []
    const taskSchedulers: Array<SpiderTaskScheduler | SenderTaskScheduler> = []
    const ctx: Ctx = {
        app_config,
        logger: log,
    }

    if (ENABLE_SENDER_WORKER) {
        const forwarderConcurrency = parseInt(process.env.SENDER_WORKER_CONCURRENCY || '3')
        const forwarderWorker = startSenderWorker(queueManager, forwarderConcurrency)
        workers.push(forwarderWorker)
        log.info(`Started forwarder worker (concurrency: ${forwarderConcurrency})`)
    }

    if (ENABLE_SCHEDULER) {
        const crawlers = app_config.getTaskCrawlers()
        if (crawlers && crawlers.length > 0) {
            const spiderScheduler = new SpiderTaskScheduler(ctx, queue_config)
            taskSchedulers.push(spiderScheduler)
            log.info(`Initialized spider scheduler with ${crawlers.length} crawler(s)`)
        }

        const senders = app_config.getTaskSenders()
        if (senders && senders.length > 0) {
            const senderScheduler = new SenderTaskScheduler(ctx, queue_config)
            taskSchedulers.push(senderScheduler)
            log.info(`Initialized sender scheduler with ${senders.length} sender(s)`)
        }

        for (const scheduler of taskSchedulers) {
            await scheduler.init()
            await scheduler.start()
        }
    }

    log.info('Scheduler service started successfully')

    async function exitHandler() {
        log.info('Shutting down gracefully...')
        for (const scheduler of taskSchedulers) {
            await scheduler.stop()
            await scheduler.drop()
        }
        for (const worker of workers) {
            await worker.close()
        }
        await queueManager.close()
        log.info('Cleanup completed')
        process.exit(0)
    }

    process.on('SIGINT', exitHandler)
    process.on('SIGTERM', exitHandler)
    process.on('SIGHUP', exitHandler)

    // Keep process running until receiving shutdown signal
    // await new Promise(() => {})
}

main()
