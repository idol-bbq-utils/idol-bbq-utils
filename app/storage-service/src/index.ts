import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { StorageJobData, JobResult, SpiderArticleResult, SpiderFollowsResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import DB, { ensureMigrations } from '@idol-bbq-utils/db'
import type { Article } from '@idol-bbq-utils/db'
import { pRetry } from '@idol-bbq-utils/utils'
import { BaseTranslator, TRANSLATION_ERROR_FALLBACK } from '@idol-bbq-utils/translator'

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

async function doTranslate(
    article: Article,
    translator: BaseTranslator,
    jobLog: ReturnType<typeof log.child>,
): Promise<Article> {
    const { username, a_id } = article
    jobLog.info(`[${username}] [${a_id}] Translating article...`)

    let currentArticle: Article | null = article
    let articleNeedTobeTranslated: Array<Article> = []

    while (currentArticle && typeof currentArticle === 'object') {
        articleNeedTobeTranslated.push(currentArticle)
        if (typeof currentArticle.ref !== 'string') {
            currentArticle = currentArticle.ref as Article
        } else {
            currentArticle = null
        }
    }

    jobLog.info(`[${username}] [${a_id}] Starting batch translating ${articleNeedTobeTranslated.length} articles...`)

    await Promise.all(
        articleNeedTobeTranslated.map(async (currentArticle) => {
            const { a_id, username, platform } = currentArticle

            const article_maybe_translated = await DB.Article.getByArticleCode(a_id, platform)

            if (currentArticle.content && !BaseTranslator.isValidTranslation(article_maybe_translated?.translation)) {
                const content = currentArticle.content
                jobLog.info(`[${username}] [${a_id}] Starting to translate content...`)
                const content_translation = await pRetry(() => translator.translate(content), {
                    retries: 3,
                    onFailedAttempt: (error) => {
                        jobLog.warn(
                            `[${username}] [${a_id}] Translation content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                        )
                    },
                })
                    .then((res) => res)
                    .catch((err) => {
                        jobLog.error(`[${username}] [${a_id}] Error while translating content: ${err}`)
                        return TRANSLATION_ERROR_FALLBACK
                    })
                jobLog.debug(`[${username}] [${a_id}] Translation content: ${content_translation}`)
                jobLog.info(`[${username}] [${a_id}] Translation complete.`)
                currentArticle.translation = content_translation
                currentArticle.translated_by = translator.NAME
            }

            if (currentArticle.media) {
                for (const [idx, media] of currentArticle.media.entries()) {
                    if (
                        media.alt &&
                        !BaseTranslator.isValidTranslation(
                            (article_maybe_translated?.media as unknown as Article['media'])?.[idx]?.translation,
                        )
                    ) {
                        const alt = media.alt
                        const caption_translation = await pRetry(() => translator.translate(alt), {
                            retries: 3,
                            onFailedAttempt: (error) => {
                                jobLog.warn(
                                    `[${username}] [${a_id}] Translation media alt failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                )
                            },
                        })
                            .then((res) => res)
                            .catch((err) => {
                                jobLog.error(`[${username}] [${a_id}] Error while translating media alt: ${err}`)
                                return TRANSLATION_ERROR_FALLBACK
                            })
                        media.translation = caption_translation
                        media.translated_by = translator.NAME
                    }
                }
            }

            if (currentArticle.extra) {
                const extra_ref = currentArticle.extra
                let { content, translation } = extra_ref
                if (content && !BaseTranslator.isValidTranslation(translation)) {
                    const content_translation = await pRetry(() => translator.translate(content), {
                        retries: 3,
                        onFailedAttempt: (error) => {
                            jobLog.warn(
                                `[${username}] [${a_id}] Translation extra content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                            )
                        },
                    })
                        .then((res) => res)
                        .catch((err) => {
                            jobLog.error(`[${username}] [${a_id}] Error while translating extra content: ${err}`)
                            return TRANSLATION_ERROR_FALLBACK
                        })
                    extra_ref.translation = content_translation
                    extra_ref.translated_by = translator.NAME
                }
            }
        }),
    )

    jobLog.info(`[${username}] [${a_id}] ${articleNeedTobeTranslated.length} Articles are translated.`)
    return article
}

async function processArticleStorage(
    articles: SpiderArticleResult[],
    translator: BaseTranslator | undefined,
    jobLog: ReturnType<typeof log.child>,
): Promise<{ savedIds: number[]; errorCount: number }> {
    const savedIds: number[] = []
    let errorCount = 0

    for (const article of articles) {
        try {
            const exists = await DB.Article.checkExist(article)

            if (!exists) {
                let translatedArticle = article
                if (translator) {
                    translatedArticle = await doTranslate(article, translator, jobLog)
                }

                const saved = await DB.Article.trySave(translatedArticle)
                if (saved) {
                    savedIds.push(saved.id)
                    jobLog.debug(`Saved article ${article.a_id} with id ${saved.id}`)
                }
            } else {
                jobLog.debug(`Article ${article.a_id} already exists, skipping`)
            }
        } catch (error) {
            jobLog.error(`Error saving article ${article.a_id}: ${error}`)
            errorCount++
        }
    }

    return { savedIds, errorCount }
}

async function processFollowsStorage(
    followsList: SpiderFollowsResult[],
    jobLog: ReturnType<typeof log.child>,
): Promise<{ savedIds: number[]; errorCount: number }> {
    const savedIds: number[] = []
    let errorCount = 0

    for (const follows of followsList) {
        try {
            const saved = await DB.Follow.save(follows)
            if (saved) {
                savedIds.push(saved.id)
            }
            jobLog.debug(`Saved follows for ${follows.username} with id ${saved?.id}`)
        } catch (error) {
            jobLog.error(`Error saving follows for ${follows.username}: ${error}`)
            errorCount++
        }
    }

    return { savedIds, errorCount }
}

async function processStorageJob(job: Job<StorageJobData>): Promise<JobResult> {
    const { task_id, task_type, data, translator_config } = job.data
    const jobLog = log.child({ task_id, task_type })

    jobLog.info(`Processing storage job: ${data.length} items (type: ${task_type})`)

    let translator: BaseTranslator | undefined = undefined

    if (translator_config && task_type === 'article') {
        try {
            const { translatorRegistry } = await import('@idol-bbq-utils/translator')
            translator = await translatorRegistry.create(
                translator_config.provider,
                translator_config.api_key,
                jobLog,
                translator_config.config,
            )
            jobLog.info(`Translator initialized: ${translator_config.provider}`)
        } catch (error) {
            jobLog.error(`Failed to initialize translator: ${error}`)
        }
    }

    let result: { savedIds: number[]; errorCount: number }

    if (task_type === 'article') {
        result = await processArticleStorage(data as SpiderArticleResult[], translator, jobLog)
        await job.updateProgress(100)
    } else if (task_type === 'follows') {
        result = await processFollowsStorage(data as SpiderFollowsResult[], jobLog)
        await job.updateProgress(100)
    } else {
        jobLog.error(`Unknown task type: ${task_type}`)
        return {
            success: false,
            count: 0,
            error: `Unknown task type: ${task_type}`,
        }
    }

    jobLog.info(`Storage job completed: ${result.savedIds.length} saved, ${result.errorCount} errors`)

    return {
        success: result.errorCount === 0,
        count: result.savedIds.length,
        data: { savedIds: result.savedIds, errorCount: result.errorCount },
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
