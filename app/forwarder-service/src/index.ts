import { createLogger } from '@idol-bbq-utils/log'
import { Worker, QueueName } from '@idol-bbq-utils/queue'
import type { ForwarderJobData, JobResult } from '@idol-bbq-utils/queue/jobs'
import type { Job } from 'bullmq'
import DB from '@idol-bbq-utils/db'
import type { Article, ArticleWithId, DBFollows } from '@idol-bbq-utils/db'
import { articleToText, followsToText, formatMetaline, ImgConverter } from '@idol-bbq-utils/render'
import { getForwarder } from '@idol-bbq-utils/forwarder'
import {
    plainDownloadMediaFile,
    galleryDownloadMediaFile,
    writeImgToFile,
    cleanupMediaFiles,
    getMediaType,
    tryGetCookie,
} from '@idol-bbq-utils/utils'
import { Platform, type MediaType } from '@idol-bbq-utils/spider/types'
import { platformPresetHeadersMap } from '@idol-bbq-utils/spider/const'
import { spiderRegistry } from '@idol-bbq-utils/spider'
import { cloneDeep, orderBy } from 'lodash'
import dayjs from 'dayjs'
import fs from 'fs'
import path from 'path'
import { Redis } from 'ioredis'

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

const MAX_ERROR_COUNT = 3
const ERROR_COUNTER_TTL = 86400

let redisConnection: Redis | null = null

function getRedisConnection(): Redis {
    if (!redisConnection) {
        redisConnection = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        })
    }
    return redisConnection
}

async function getErrorCount(platform: Platform, articleId: string, targetId: string): Promise<number> {
    const redis = getRedisConnection()
    const key = `error_count:${platform}:${articleId}:${targetId}`
    const count = await redis.get(key)
    return count ? parseInt(count, 10) : 0
}

async function incrementErrorCount(platform: Platform, articleId: string, targetId: string): Promise<number> {
    const redis = getRedisConnection()
    const key = `error_count:${platform}:${articleId}:${targetId}`
    const newCount = await redis.incr(key)
    await redis.expire(key, ERROR_COUNTER_TTL)
    return newCount
}

async function deleteErrorCount(platform: Platform, articleId: string, targetId: string): Promise<void> {
    const redis = getRedisConnection()
    const key = `error_count:${platform}:${articleId}:${targetId}`
    await redis.del(key)
}

async function handleMedia(
    article: Article,
    forwarderConfig: ForwarderJobData['forwarderConfig'],
    taskId: string,
    jobLog: ReturnType<typeof log.child>,
): Promise<Array<{ path: string; media_type: MediaType }>> {
    const maybe_media_files: Array<{ path: string; media_type: MediaType }> = []

    if (!forwarderConfig.media) {
        return maybe_media_files
    }

    let currentArticle: Article | null = article

    while (currentArticle) {
        if (currentArticle.has_media) {
            jobLog.debug(`Downloading media files for article ${currentArticle.a_id}`)

            let cookie: string | undefined = undefined
            if ([Platform.TikTok].includes(currentArticle.platform)) {
                cookie = await tryGetCookie(currentArticle.url)
            }

            const downloadWithHeaders = async (url: string, type: MediaType, overrideType?: boolean) => {
                try {
                    const headers: Record<string, string> = {
                        ...(cookie ? { cookie } : {}),
                        ...(currentArticle?.platform ? platformPresetHeadersMap[currentArticle.platform] : {}),
                    }

                    let filePath: string | undefined

                    if (forwarderConfig.media?.use?.tool === 'gallery-dl' && forwarderConfig.media.use.path) {
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
                        return {
                            path: filePath,
                            media_type: overrideType ? getMediaType(filePath) : type,
                        }
                    }
                } catch (error) {
                    jobLog.error(`Error downloading media file: ${error}, skipping ${url}`)
                }
                return undefined
            }

            if (forwarderConfig.media.use?.tool === 'gallery-dl' && forwarderConfig.media.use.path) {
                jobLog.debug(`Downloading media with gallery-dl for article URL: ${currentArticle.url}`)
                const paths = galleryDownloadMediaFile(
                    currentArticle.url,
                    CACHE_DIR,
                    {
                        path: forwarderConfig.media.use.path,
                        cookie_file: forwarderConfig.media.use.cookieFile,
                    },
                    taskId,
                )
                maybe_media_files.push(
                    ...paths.map((path) => ({
                        path,
                        media_type: getMediaType(path),
                    })),
                )
            } else {
                if (currentArticle.media) {
                    const mediaArray = Array.isArray(currentArticle.media) ? currentArticle.media : []
                    const files = await Promise.all(
                        mediaArray
                            .filter((m) => m)
                            .map((m) => {
                                const url = typeof m === 'object' && 'url' in m ? String(m.url) : String(m)
                                const type = (
                                    typeof m === 'object' && 'type' in m ? String(m.type) : 'photo'
                                ) as MediaType
                                return downloadWithHeaders(url, type)
                            }),
                    )
                    maybe_media_files.push(...files.filter((f) => f !== undefined))
                }
            }

            if (currentArticle.extra?.media) {
                const extraMediaArray = Array.isArray(currentArticle.extra.media) ? currentArticle.extra.media : []
                const extraFiles = await Promise.all(
                    extraMediaArray
                        .filter((m) => m)
                        .map((m) => {
                            const url = typeof m === 'object' && 'url' in m ? String(m.url) : String(m)
                            const type = (typeof m === 'object' && 'type' in m ? String(m.type) : 'photo') as MediaType
                            return downloadWithHeaders(url, type, true)
                        }),
                )
                maybe_media_files.push(...extraFiles.filter((f) => f !== undefined))
            }
        }

        if (currentArticle.ref && typeof currentArticle.ref === 'object') {
            currentArticle = currentArticle.ref as Article
        } else {
            currentArticle = null
        }
    }

    return maybe_media_files
}

async function processFollowsTask(
    job: Job<ForwarderJobData>,
    jobLog: ReturnType<typeof log.child>,
): Promise<JobResult> {
    const { taskId, urls, forwarderConfig, followsConfig } = job.data
    const { taskTitle, comparisonWindow = '1d' } = followsConfig || {}

    jobLog.info(`Processing follows forwarding for ${urls.length} websites`)

    const results = new Map<Platform, Array<[DBFollows, DBFollows | null]>>()

    for (const website of urls) {
        try {
            const url = new URL(website)
            const { platform, u_id } = spiderRegistry.extractBasicInfo(url.href) ?? {}

            if (!platform || !u_id) {
                jobLog.error(`Invalid url: ${url.href}`)
                continue
            }

            const follows = await DB.Follow.getLatestAndComparisonFollowsByName(u_id, platform, comparisonWindow)
            if (!follows) {
                jobLog.warn(`No follows found for ${url.href}`)
                continue
            }

            let result = results.get(platform)
            if (!result) {
                result = []
                results.set(platform, result)
            }
            result.push(follows)
        } catch (error) {
            jobLog.error(`Error processing website ${website}: ${error}`)
        }
    }

    if (results.size === 0) {
        jobLog.warn('No follows data to send')
        return { success: true, count: 0 }
    }

    let texts_to_send = followsToText(orderBy(Array.from(results.entries()), (i) => i[0], 'asc'))
    if (taskTitle) {
        texts_to_send = `${taskTitle}\n${texts_to_send}`
    }

    let successCount = 0
    let errorCount = 0

    for (const target of forwarderConfig.targets) {
        try {
            const ForwarderClass = getForwarder(target.platform)
            if (!ForwarderClass) {
                jobLog.error(`Unknown platform: ${target.platform}`)
                errorCount++
                continue
            }

            const forwarder = new ForwarderClass(target.cfg_platform, target.id, jobLog)
            await forwarder.init()

            await forwarder.send(texts_to_send, {
                timestamp: dayjs().unix(),
                runtime_config: target.runtime_config,
            })

            successCount++
            jobLog.info(`Forwarded follows to ${target.id}`)
        } catch (error) {
            jobLog.error(`Error forwarding follows to ${target.id}: ${error}`)
            errorCount++
        }
    }

    jobLog.info(`Follows forwarding completed: ${successCount} succeeded, ${errorCount} failed`)

    return {
        success: errorCount === 0,
        count: successCount,
        data: { successCount, errorCount },
    }
}

async function processForwarderJob(job: Job<ForwarderJobData>): Promise<JobResult> {
    const { taskId, storageTaskId, taskType, articleIds, forwarderConfig } = job.data
    const jobLog = log.child({ taskId, storageTaskId, taskType })

    if (taskType === 'follows') {
        return await processFollowsTask(job, jobLog)
    }

    if (!articleIds || articleIds.length === 0) {
        jobLog.warn('No article IDs provided')
        return { success: true, count: 0 }
    }

    jobLog.info(`Processing forwarder job: ${articleIds.length} articles to ${forwarderConfig.targets.length} targets`)

    const allArticles: ArticleWithId[] = []

    for (const id of articleIds) {
        const article = await DB.Article.getSingleArticle(id)
        if (article) {
            allArticles.push(article)
        }
    }

    if (allArticles.length === 0) {
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

            for (const article of allArticles) {
                let mediaFiles: Array<{ path: string; media_type: MediaType }> = []

                try {
                    const exists = await DB.ForwardBy.checkExist(article.id, target.id, 'article')

                    if (exists) {
                        jobLog.debug(`Article ${article.a_id} already forwarded to ${target.id}`)
                        continue
                    }

                    const article_is_blocked = forwarder.check_blocked('', {
                        timestamp: article.created_at,
                        runtime_config: target.runtime_config,
                        article: cloneDeep(article),
                    })

                    if (article_is_blocked) {
                        jobLog.warn(`Article ${article.a_id} is blocked by ${target.id}, marking as forwarded`)
                        let currentArticle: ArticleWithId | null = article
                        while (currentArticle && typeof currentArticle === 'object') {
                            await DB.ForwardBy.save(currentArticle.id, target.id, 'article')
                            currentArticle = currentArticle.ref as ArticleWithId | null
                        }
                        continue
                    }

                    let articleToImgSuccess = false

                    mediaFiles = await handleMedia(article, forwarderConfig, taskId, jobLog)

                    if (forwarderConfig.renderType?.startsWith('img')) {
                        try {
                            const imgBuffer = await articleConverter.articleToImg(cloneDeep(article))

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

                    const fullText = articleToText(article)

                    let text = articleToImgSuccess ? formatMetaline(article) : fullText

                    text = forwarderConfig.renderType === 'img' ? '' : text

                    let currentArticle: ArticleWithId | null = article
                    while (currentArticle && typeof currentArticle === 'object') {
                        await DB.ForwardBy.save(currentArticle.id, target.id, 'article')
                        currentArticle = currentArticle.ref as ArticleWithId | null
                    }

                    let sendSuccess = false
                    try {
                        await forwarder.send(text, {
                            media: mediaFiles,
                            article: cloneDeep(article),
                            timestamp: article.created_at,
                            runtime_config: target.runtime_config,
                        })
                        sendSuccess = true
                        successCount++
                        jobLog.info(`Forwarded article ${article.a_id} to ${target.id}`)

                        await deleteErrorCount(article.platform, article.a_id, target.id)
                    } catch (sendError) {
                        jobLog.error(`Error sending article ${article.a_id} to ${target.id}: ${sendError}`)

                        let currentArticle: ArticleWithId | null = article
                        while (currentArticle && typeof currentArticle === 'object') {
                            await DB.ForwardBy.deleteRecord(currentArticle.id, target.id, 'article')
                            currentArticle = currentArticle.ref as ArticleWithId | null
                        }

                        const currentErrorCount = await incrementErrorCount(article.platform, article.a_id, target.id)

                        if (currentErrorCount > MAX_ERROR_COUNT) {
                            jobLog.error(
                                `Error count exceeded for ${article.a_id} to ${target.id} (${currentErrorCount} attempts), marking as forwarded to skip`,
                            )
                            let currentArticle: ArticleWithId | null = article
                            while (currentArticle && typeof currentArticle === 'object') {
                                await DB.ForwardBy.save(currentArticle.id, target.id, 'article')
                                currentArticle = currentArticle.ref as ArticleWithId | null
                            }
                            await deleteErrorCount(article.platform, article.a_id, target.id)
                        } else {
                            jobLog.warn(
                                `Error count for ${article.a_id} to ${target.id}: ${currentErrorCount}/${MAX_ERROR_COUNT}`,
                            )
                        }

                        errorCount++
                    }
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

    const cacheDirs = [path.join(CACHE_DIR, 'media', 'plain'), path.join(CACHE_DIR, 'media', 'gallery-dl')]
    cacheDirs.forEach((dir) => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
            log.info(`Created cache directory: ${dir}`)
        }
    })

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
        if (redisConnection) {
            await redisConnection.quit()
            log.info('Redis connection closed')
        }
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
