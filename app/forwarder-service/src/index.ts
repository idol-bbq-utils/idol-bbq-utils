import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { ForwarderJobData, JobResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import { PrismaClient } from '../prisma/client'
import { articleToText, formatMetaline } from '@idol-bbq-utils/render'

const log = createLogger({ defaultMeta: { service: 'ForwarderService' } })

interface ForwarderServiceConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
    concurrency?: number
}

const prisma = new PrismaClient()

async function processForwarderJob(job: Job<ForwarderJobData>): Promise<JobResult> {
    const { taskId, storageTaskId, articleIds, forwarderConfig } = job.data
    const jobLog = log.child({ taskId, storageTaskId })

    jobLog.info(`Processing forwarder job: ${articleIds.length} articles to ${forwarderConfig.targets.length} targets`)

    const articles = await prisma.crawler_article.findMany({
        where: {
            id: { in: articleIds },
        },
    })

    if (articles.length === 0) {
        jobLog.warn('No articles found for forwarding')
        return { success: true, count: 0 }
    }

    let successCount = 0
    let errorCount = 0

    for (const article of articles) {
        try {
            const text = articleToText(article as any)

            for (const targetId of forwarderConfig.targets) {
                try {
                    jobLog.info(`Forwarding article ${article.a_id} to ${targetId}`)

                    const exists = await prisma.forward_by.findFirst({
                        where: {
                            ref_id: article.id,
                            bot_id: targetId,
                            task_type: 'article',
                        },
                    })

                    if (!exists) {
                        await prisma.forward_by.create({
                            data: {
                                ref_id: article.id,
                                bot_id: targetId,
                                task_type: 'article',
                            },
                        })
                        successCount++
                        jobLog.debug(`Marked article ${article.a_id} as forwarded to ${targetId}`)
                    }
                } catch (targetError) {
                    jobLog.error(`Error forwarding to ${targetId}: ${targetError}`)
                    errorCount++
                }
            }

            await job.updateProgress(((articles.indexOf(article) + 1) / articles.length) * 100)
        } catch (error) {
            jobLog.error(`Error processing article ${article.a_id}: ${error}`)
            errorCount++
        }
    }

    jobLog.info(`Forwarder job completed: ${successCount} forwarded, ${errorCount} errors`)

    return {
        success: errorCount === 0,
        count: successCount,
        data: { successCount, errorCount },
    }
}

async function main() {
    const config: ForwarderServiceConfig = {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
    }

    log.info('Starting Forwarder Service...')
    log.info(`Redis: ${config.redis.host}:${config.redis.port}`)
    log.info(`Concurrency: ${config.concurrency}`)

    await prisma.$connect()
    log.info('Database connected')

    const worker = new Worker<ForwarderJobData, JobResult>(QueueName.FORWARDER, processForwarderJob, {
        connection: config.redis,
        concurrency: config.concurrency,
        limiter: {
            max: 20,
            duration: 60000,
        },
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

    log.info('Forwarder Service started, waiting for jobs...')

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
    log.error(`Failed to start Forwarder Service: ${err}`)
    process.exit(1)
})
