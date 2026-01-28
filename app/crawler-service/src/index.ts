import { createLogger, winston } from '@idol-bbq-utils/log'
import { createCrawlerWorker } from '@idol-bbq-utils/queue'
import { getCacheRoot } from '@idol-bbq-utils/utils'
import tmp from 'tmp'
import PQueue from 'p-queue'
import path from 'path'
import { BrowserPool, processCrawlerJob } from './workers/crawler'

tmp.setGracefulCleanup()
const CACHE_DIR_ROOT = getCacheRoot()
const log = createLogger({
    defaultMeta: { service: 'crawler-service' },
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(CACHE_DIR_ROOT, 'logs', 'crawler-service-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '3d',
            auditFile: path.join(CACHE_DIR_ROOT, 'logs', '.audit.json'),
        }),
    ],
})

interface CrawlerServiceConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
    concurrency?: number
    browserPoolSize?: number
    storageQueueConcurrency?: number
}

async function main() {
    const config: CrawlerServiceConfig = {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        browserPoolSize: parseInt(process.env.BROWSER_POOL_SIZE || '1'),
        storageQueueConcurrency: parseInt(process.env.STORAGE_QUEUE_CONCURRENCY || '3'),
    }

    log.info('Starting Crawler Service (with integrated storage)...')
    log.info(`Redis: ${config.redis.host}:${config.redis.port}`)
    log.info(`Concurrency: ${config.concurrency}`)
    log.info(`Browser Pool Size: ${config.browserPoolSize}`)
    log.info(`Storage Queue Concurrency: ${config.storageQueueConcurrency}`)

    const browserPool = new BrowserPool(config.browserPoolSize, log)
    await browserPool.init()

    const storageQueue = new PQueue({ concurrency: config.storageQueueConcurrency })

    const worker = createCrawlerWorker((job) => processCrawlerJob(job, browserPool, storageQueue, log), {
        connection: config.redis,
        concurrency: config.concurrency,
        limiter: {
            max: 10,
            duration: 12 * 60 * 1000, // 12 minutes
        },
    })

    worker.on('completed', (job) => {
        log.info(`Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        log.error(`Job ${job?.id} failed: ${err.message}`)
    })

    worker.on('error', (err) => {
        log.error(`Worker error: ${err.message}`)
    })

    log.info('Crawler Service started, waiting for jobs...')

    async function shutdown() {
        log.info('Shutting down...')
        await worker.close()
        storageQueue.clear()
        await storageQueue.onIdle()
        await browserPool.close()
        log.info('Shutdown complete')
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch((err) => {
    log.error(`Failed to start Crawler Service: ${err}`)
    process.exit(1)
})
