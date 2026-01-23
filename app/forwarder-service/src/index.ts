import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { ForwarderJobData, JobResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import { PrismaClient } from '../prisma/client'
import { articleToText, formatMetaline, ImgConverter } from '@idol-bbq-utils/render'
import { getForwarder } from '@idol-bbq-utils/forwarder'
import {
    plainDownloadMediaFile,
    galleryDownloadMediaFile,
    writeImgToFile,
    cleanupMediaFiles,
} from '@idol-bbq-utils/utils'
import { Platform } from '@idol-bbq-utils/spider/types'
import type { MediaType } from '@idol-bbq-utils/utils'
import { platformPresetHeadersMap } from '@idol-bbq-utils/spider/const'

const log = createLogger({ defaultMeta: { service: 'ForwarderService' } })
const CACHE_DIR = process.env.CACHE_DIR_ROOT || '/tmp'
const articleConverter = new ImgConverter()

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

    for (const target of forwarderConfig.targets) {
        jobLog.info(`Processing target: ${target.id} (${target.platform})`)

        try {
            const ForwarderClass = getForwarder(target.platform)
            if (!ForwarderClass) {
                jobLog.error(`Unknown platform: ${target.platform}`)
                errorCount++
                continue
            }

            const forwarder = new ForwarderClass(target.cfg_platform, target.id, jobLog)
            await forwarder.init()

            for (const article of articles) {
                let mediaFiles: Array<{ path: string; media_type: MediaType }> = []

                try {
                    const exists = await prisma.forward_by.findFirst({
                        where: {
                            ref_id: article.id,
                            bot_id: target.id,
                            task_type: 'article',
                        },
                    })

                    if (exists) {
                        jobLog.debug(`Article ${article.a_id} already forwarded to ${target.id}`)
                        continue
                    }

                    let articleToImgSuccess = false

                    if (forwarderConfig.media && article.has_media && article.media) {
                        jobLog.debug(`Downloading media files for article ${article.a_id}`)

                        const mediaArray = Array.isArray(article.media) ? article.media : []

                        for (const mediaItem of mediaArray) {
                            if (!mediaItem) continue

                            try {
                                const url =
                                    typeof mediaItem === 'object' && 'url' in mediaItem && mediaItem.url
                                        ? String(mediaItem.url)
                                        : String(mediaItem)
                                const type =
                                    typeof mediaItem === 'object' && 'type' in mediaItem && mediaItem.type
                                        ? String(mediaItem.type)
                                        : 'photo'

                                const headers: Record<string, string> = {}
                                if (article.platform && platformPresetHeadersMap[article.platform as Platform]) {
                                    Object.assign(headers, platformPresetHeadersMap[article.platform as Platform])
                                }

                                let filePath: string | undefined
                                if (
                                    forwarderConfig.media.use?.tool === 'gallery-dl' &&
                                    forwarderConfig.media.use.path
                                ) {
                                    const paths = galleryDownloadMediaFile(
                                        url,
                                        CACHE_DIR,
                                        {
                                            path: forwarderConfig.media.use.path,
                                            cookie_file: forwarderConfig.media.use.cookieFile,
                                        },
                                        taskId,
                                    )
                                    if (paths.length > 0) {
                                        filePath = paths[0]
                                    }
                                } else {
                                    filePath = await plainDownloadMediaFile(url, CACHE_DIR, taskId, headers)
                                }

                                if (filePath) {
                                    mediaFiles.push({
                                        path: filePath,
                                        media_type: type as MediaType,
                                    })
                                }
                            } catch (mediaError) {
                                jobLog.error(`Error downloading media: ${mediaError}`)
                            }
                        }
                    }

                    if (forwarderConfig.renderType?.startsWith('img')) {
                        try {
                            const imgBuffer = await articleConverter.articleToImg({
                                ...article,
                                content: article.content || '',
                                created_at: article.created_at,
                                media: article.media as any,
                                extra: article.extra as any,
                            } as any)

                            const imgPath = writeImgToFile(
                                imgBuffer,
                                CACHE_DIR,
                                `${taskId}-${article.a_id}-rendered.png`,
                            )

                            mediaFiles.unshift({
                                path: imgPath,
                                media_type: 'photo',
                            })
                            articleToImgSuccess = true
                            jobLog.debug(`Converted article ${article.a_id} to image`)
                        } catch (imgError) {
                            jobLog.error(`Error converting article to image: ${imgError}`)
                        }
                    }

                    const fullText = articleToText({
                        ...article,
                        content: article.content || '',
                        created_at: article.created_at,
                    })

                    let text = articleToImgSuccess
                        ? formatMetaline({
                              ...article,
                              content: article.content || '',
                              created_at: article.created_at,
                          } as any)
                        : fullText

                    text = forwarderConfig.renderType === 'img' ? '' : text

                    await forwarder.send(text, {
                        media: mediaFiles,
                        article: {
                            ...article,
                            content: article.content || '',
                            created_at: article.created_at,
                        } as any,
                        timestamp: article.created_at,
                        runtime_config: target.runtime_config,
                    })

                    let currentArticleId: number | null = article.id
                    while (currentArticleId) {
                        await prisma.forward_by.create({
                            data: {
                                ref_id: currentArticleId,
                                bot_id: target.id,
                                task_type: 'article',
                            },
                        })

                        const refArticle = await prisma.crawler_article.findUnique({
                            where: { id: currentArticleId },
                        })

                        if (refArticle && refArticle.ref && typeof refArticle.ref === 'number') {
                            currentArticleId = refArticle.ref
                        } else {
                            currentArticleId = null
                        }
                    }

                    successCount++
                    jobLog.info(`Forwarded article ${article.a_id} to ${target.id}`)
                } catch (articleError) {
                    jobLog.error(`Error forwarding article ${article.a_id} to ${target.id}: ${articleError}`)
                    errorCount++
                } finally {
                    if (mediaFiles.length > 0) {
                        cleanupMediaFiles(mediaFiles.map((f) => f.path))
                        jobLog.debug(`Cleaned up ${mediaFiles.length} media files`)
                    }
                }
            }
        } catch (targetError) {
            jobLog.error(`Error initializing forwarder for ${target.id}: ${targetError}`)
            errorCount++
        }

        await job.updateProgress(((forwarderConfig.targets.indexOf(target) + 1) / forwarderConfig.targets.length) * 100)
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
        log.info(`Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        log.error(`Job ${job?.id} failed: ${err.message}`)
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
