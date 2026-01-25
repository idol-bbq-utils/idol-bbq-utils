import { log } from './config'
import { AppConfig, parseConfigFromFile } from '@idol-bbq-utils/config'
import { SpiderTaskScheduler } from './schedulers/spider-scheduler'
import { ForwarderTaskScheduler } from './schedulers/sender-scheduler'
import { ensureMigrations } from '@idol-bbq-utils/db'
import type { Ctx } from './types'

async function main() {
    await ensureMigrations()

    const config = parseConfigFromFile('./config.yaml')
    if (!config) {
        log.error('Config file is empty or invalid, exiting...')
        return
    }

    const app_config = new AppConfig(config)

    const queue_config = {
        enabled: true,
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
    }

    log.info('Scheduler service initializing...')
    log.debug(`Redis: ${queue_config.redis.host}:${queue_config.redis.port}`)

    const taskSchedulers: Array<SpiderTaskScheduler | ForwarderTaskScheduler> = []
    const ctx: Ctx = {
        app_config,
        logger: log,
    }

    const crawlers = app_config.getTaskCrawlers()
    if (crawlers && crawlers.length > 0) {
        const spiderScheduler = new SpiderTaskScheduler(ctx, queue_config)
        taskSchedulers.push(spiderScheduler)
        log.info(`Initialized spider scheduler with ${crawlers.length} crawler(s)`)
    }

    const senders = app_config.getTaskSenders()
    if (senders && senders.length > 0) {
        const forwarderScheduler = new ForwarderTaskScheduler(ctx, queue_config)
        taskSchedulers.push(forwarderScheduler)
        log.info(`Initialized sender scheduler with ${senders.length} sender(s)`)
    }

    for (const scheduler of taskSchedulers) {
        await scheduler.init()
        await scheduler.start()
    }

    log.info('Scheduler service started successfully')

    async function exitHandler() {
        log.info('Shutting down gracefully...')
        for (const scheduler of taskSchedulers) {
            await scheduler.stop()
            await scheduler.drop()
        }
        log.info('Cleanup completed')
        process.exit(0)
    }

    process.on('SIGINT', exitHandler)
    process.on('SIGTERM', exitHandler)
    process.on('SIGHUP', exitHandler)
}

main()
