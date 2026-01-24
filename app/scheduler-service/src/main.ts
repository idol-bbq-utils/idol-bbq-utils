import { configParser, log } from './config'
import { SpiderTaskScheduler } from './schedulers/spider-scheduler'
import { ForwarderTaskScheduler } from './schedulers/forwarder-scheduler'
import EventEmitter from 'events'

async function main() {
    const config = configParser('./config.yaml')
    if (!config) {
        log.error('Config file is empty or invalid, exiting...')
        return
    }

    const { crawlers, cfg_crawler, forwarders, cfg_forwarder, forward_targets, cfg_forward_target } = config
    forward_targets?.forEach((target) => {
        target.cfg_platform = {
            ...cfg_forward_target,
            ...target.cfg_platform,
        }
    })


    const queueConfig = {
        enabled: true,
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
    }

    log.info('Scheduler service initializing...')
    log.info(`Redis: ${queueConfig.redis.host}:${queueConfig.redis.port}`)

    const emitter = new EventEmitter()
    const taskSchedulers: Array<SpiderTaskScheduler | ForwarderTaskScheduler> = []

    if (crawlers && crawlers.length > 0) {
        const spiderScheduler = new SpiderTaskScheduler({ crawlers, cfg_crawler }, emitter, log, queueConfig)
        taskSchedulers.push(spiderScheduler)
        log.info(`Initialized spider scheduler with ${crawlers.length} crawler(s)`)
    }

    if (forwarders && forwarders.length > 0) {
        const forwarderScheduler = new ForwarderTaskScheduler(
            { forwarders, cfg_forwarder, forward_targets },
            emitter,
            log,
            queueConfig,
        )
        taskSchedulers.push(forwarderScheduler)
        log.info(`Initialized forwarder scheduler with ${forwarders.length} forwarder(s)`)
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
