import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { StorageJobData, JobResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import { PrismaClient } from '../prisma/client'

const log = createLogger({ defaultMeta: { service: 'StorageService' } })

interface StorageServiceConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
    concurrency?: number
}

const prisma = new PrismaClient()

async function processStorageJob(job: Job<StorageJobData>): Promise<JobResult> {
    const { taskId, crawlerTaskId, articles } = job.data
    const jobLog = log.child({ taskId, crawlerTaskId })

    jobLog.info(`Processing storage job: ${articles.length} articles`)

    const savedIds: number[] = []
    let errorCount = 0

    for (const article of articles) {
        try {
            const exists = await prisma.crawler_article.findFirst({
                where: {
                    a_id: article.a_id,
                    platform: article.platform,
                },
            })

            if (!exists) {
                const saved = await prisma.crawler_article.create({
                    data: {
                        platform: article.platform,
                        a_id: article.a_id,
                        u_id: article.u_id,
                        username: article.username,
                        created_at: article.created_at,
                        content: article.content,
                        translation: article.translation,
                        translated_by: article.translated_by,
                        url: article.url,
                        type: article.type,
                        has_media: article.has_media,
                        media: article.media ? JSON.parse(JSON.stringify(article.media)) : null,
                        extra: article.extra ? JSON.parse(JSON.stringify(article.extra)) : null,
                    },
                })
                savedIds.push(saved.id)
                jobLog.debug(`Saved article ${article.a_id}`)
            } else {
                jobLog.debug(`Article ${article.a_id} already exists, skipping`)
            }

            await job.updateProgress(((articles.indexOf(article) + 1) / articles.length) * 100)
        } catch (error) {
            jobLog.error(`Error saving article ${article.a_id}: ${error}`)
            errorCount++
        }
    }

    jobLog.info(`Storage job completed: ${savedIds.length} saved, ${errorCount} errors`)

    return {
        success: errorCount === 0,
        count: savedIds.length,
        data: { savedIds, errorCount },
    }
}

async function main() {
    const config: StorageServiceConfig = {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
    }

    log.info('Starting Storage Service...')
    log.info(`Redis: ${config.redis.host}:${config.redis.port}`)
    log.info(`Concurrency: ${config.concurrency}`)

    await prisma.$connect()
    log.info('Database connected')

    const worker = new Worker<StorageJobData, JobResult>(QueueName.STORAGE, processStorageJob, {
        connection: config.redis,
        concurrency: config.concurrency,
    })

    worker.on('completed', (job) => {
        log.info(`✅ Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        log.error(`❌ Job ${job?.id} failed: ${err.message}`)
    })

    worker.on('error', (err) => {
        log.error(`Worker error: ${err.message}`)
    })

    log.info('Storage Service started, waiting for jobs...')

    async function shutdown() {
        log.info('Shutting down...')
        await worker.close()
        await prisma.$disconnect()
        log.info('Shutdown complete')
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch((err) => {
    log.error(`Failed to start Storage Service: ${err}`)
    process.exit(1)
})
