import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { StorageJobData, JobResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import { prisma } from '@idol-bbq-utils/db/client'
import { pRetry } from '@idol-bbq-utils/utils'

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

async function processStorageJob(job: Job<StorageJobData>): Promise<JobResult> {
    const { taskId, crawlerTaskId, articles, translatorConfig } = job.data
    const jobLog = log.child({ taskId, crawlerTaskId })

    jobLog.info(`Processing storage job: ${articles.length} articles`)

    const savedIds: number[] = []
    let errorCount = 0
    let translator: any = undefined

    // 1. 如果配置了翻译器，初始化翻译器
    if (translatorConfig) {
        try {
            const { translatorRegistry } = await import('@idol-bbq-utils/translator')
            translator = await translatorRegistry.create(
                translatorConfig.provider,
                translatorConfig.apiKey,
                jobLog,
                translatorConfig.config,
            )
            jobLog.info(`Translator initialized: ${translatorConfig.provider}`)
        } catch (error) {
            jobLog.error(`Failed to initialize translator: ${error}`)
        }
    }

    // 2. 遍历每篇文章：判重 → 翻译（如果是新文章）→ 存储
    for (const article of articles) {
        try {
            const exists = await prisma.crawler_article.findFirst({
                where: {
                    a_id: article.a_id,
                    platform: article.platform,
                },
            })

            if (!exists) {
                // ⭐ 新文章：先翻译再保存
                let translation = article.translation
                let translated_by = article.translated_by

                if (translator && !translation) {
                    try {
                        translation = await pRetry(() => translator.translate(article.content), {
                            retries: 3,
                            onFailedAttempt: (error) => {
                                jobLog.warn(
                                    `Translation failed for ${article.a_id}, ${error.retriesLeft} retries left: ${error.message}`,
                                )
                            },
                        })
                        translated_by = translatorConfig?.provider
                        jobLog.debug(`Translated article ${article.a_id}`)
                    } catch (error) {
                        jobLog.error(`Translation error for ${article.a_id}: ${error}`)
                        translation = '[Translation Error]'
                        translated_by = translatorConfig?.provider
                    }
                }

                // 保存文章（包含翻译）
                const saved = await prisma.crawler_article.create({
                    data: {
                        platform: article.platform,
                        a_id: article.a_id,
                        u_id: article.u_id,
                        username: article.username,
                        created_at: article.created_at,
                        content: article.content,
                        translation: translation || null,
                        translated_by: translated_by || null,
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
        log.info(`Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        log.error(`Job ${job?.id} failed: ${err.message}`)
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
