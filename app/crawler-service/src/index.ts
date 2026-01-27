import { createLogger } from '@idol-bbq-utils/log'
import { createCrawlerWorker, type Job } from '@idol-bbq-utils/queue'
import type {
    CrawlerJobData,
    JobResult,
    SpiderResult,
    SpiderArticleResult,
    SpiderFollowsResult,
} from '@idol-bbq-utils/queue/jobs'
import { spiderRegistry, parseNetscapeCookieToPuppeteerCookie } from '@idol-bbq-utils/spider'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { pRetry } from '@idol-bbq-utils/utils'
import tmp from 'tmp'
import DB from '@idol-bbq-utils/db'
import type { Article } from '@idol-bbq-utils/db'
import { BaseTranslator, TRANSLATION_ERROR_FALLBACK } from '@idol-bbq-utils/translator'
import PQueue from 'p-queue'

tmp.setGracefulCleanup()

const log = createLogger({ defaultMeta: { service: 'CrawlerService' } })

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

class BrowserPool {
    private browsers: Browser[] = []
    private tmpDirs: tmp.DirResult[] = []
    private currentIndex = 0
    private maxBrowsers: number

    constructor(maxBrowsers: number = 2) {
        this.maxBrowsers = maxBrowsers
    }

    async init(): Promise<void> {
        log.info(`Initializing browser pool with ${this.maxBrowsers} browsers...`)
        for (let i = 0; i < this.maxBrowsers; i++) {
            const tmpDir = tmp.dirSync({
                prefix: `puppeteer-${i}-`,
                unsafeCleanup: true,
            })
            this.tmpDirs.push(tmpDir)
            log.info(`Browser ${i + 1} userDataDir: ${tmpDir.name}`)

            const browser = await puppeteer.launch({
                headless: true,
                args: [process.env.NO_SANDBOX ? '--no-sandbox' : '', '--disable-dev-shm-usage'].filter(Boolean),
                channel: 'chrome',
                userDataDir: tmpDir.name,
            })
            this.browsers.push(browser)
            log.info(`Browser ${i + 1} launched`)
        }
    }

    async getPage(): Promise<Page> {
        if (this.browsers.length === 0) {
            throw new Error('Browser pool not initialized')
        }
        const browser = this.browsers[this.currentIndex]!
        this.currentIndex = (this.currentIndex + 1) % this.browsers.length
        return await browser.newPage()
    }

    async close(): Promise<void> {
        log.info('Closing browser pool...')
        await Promise.all(this.browsers.map((b) => b.close()))
        this.tmpDirs.forEach((tmpDir) => {
            try {
                tmpDir.removeCallback()
            } catch (error) {
                log.warn(`Failed to cleanup tmpDir: ${error}`)
            }
        })
        log.info('Browser pool closed')
    }
}

// Storage processing functions (from storage-service)
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

async function processCrawlerJob(
    job: Job<CrawlerJobData>,
    browserPool: BrowserPool,
    storageQueue: PQueue,
): Promise<JobResult> {
    const { task_id, task_type, name, websites, config } = job.data
    const jobLog = log.child({ trace_id: task_id, name })

    jobLog.info(`Processing crawler job: ${websites.length} websites`)

    let page: Page | undefined
    const results: SpiderResult[] = []

    try {
        const needsBrowser = !config.engine?.startsWith('api')
        const cookies = parseNetscapeCookieToPuppeteerCookie(config.cookie_string, config.cookie_file)
        if (needsBrowser) {
            page = await browserPool.getPage()
            await page.setUserAgent(config.user_agent)
            if (cookies.length > 0) {
                await page.browserContext().setCookie(...cookies)
            }
        }

        let cookie_string: string | undefined
        if (cookies.length > 0) {
            cookie_string = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
        }

        for (const website of websites) {
            try {
                const plugin = spiderRegistry.findByUrl(website)
                if (!plugin) {
                    jobLog.warn(`Spider not found for ${website}`)
                    continue
                }

                const spider = plugin.create(jobLog)

                if (config.interval_time) {
                    const delay = Math.floor(
                        Math.random() * (config.interval_time.max - config.interval_time.min) +
                            config.interval_time.min,
                    )
                    jobLog.debug(`Waiting ${delay}ms before crawling...`)
                    await new Promise((r) => setTimeout(r, delay))
                }

                const cur_results = (await pRetry(
                    () =>
                        spider.crawl(website, page, task_id, {
                            task_type: task_type,
                            crawl_engine: config.engine,
                            sub_task_type: config.sub_task_type,
                            cookie_string,
                        }),
                    {
                        retries: 3,
                        onFailedAttempt: (error) => {
                            jobLog.warn(
                                `Crawl failed for ${website}, ${error.retriesLeft} retries left: ${error.message}`,
                            )
                        },
                    },
                )) as Array<SpiderResult>

                results?.push(...cur_results)
                jobLog.info(`Crawled ${website}: ${cur_results.length} items`)

                await job.updateProgress(((websites.indexOf(website) + 1) / websites.length) * 100)
            } catch (error) {
                jobLog.error(`Error crawling ${website}: ${error}`)
            }
        }

        if (results.length > 0) {
            jobLog.info(`Dispatching ${results.length} items to internal storage queue`)

            let translator: BaseTranslator | undefined = undefined
            if (config.translator && task_type === 'article') {
                try {
                    const { translatorRegistry } = await import('@idol-bbq-utils/translator')
                    translator = await translatorRegistry.create(
                        config.translator.provider,
                        config.translator.api_key,
                        jobLog,
                        config.translator.config,
                    )
                    jobLog.info(`Translator initialized: ${config.translator.provider}`)
                } catch (error) {
                    jobLog.error(`Failed to initialize translator: ${error}`)
                }
            }

            storageQueue
                .add(async () => {
                    const storageLog = log.child({ trace_id: `${task_id}-storage`, task_type })
                    storageLog.info(`Processing storage: ${results.length} items (type: ${task_type})`)

                    let result: { savedIds: number[]; errorCount: number }

                    if (task_type === 'article') {
                        result = await processArticleStorage(results as SpiderArticleResult[], translator, storageLog)
                    } else if (task_type === 'follows') {
                        result = await processFollowsStorage(results as SpiderFollowsResult[], storageLog)
                    } else {
                        storageLog.error(`Unknown task type: ${task_type}`)
                        return
                    }

                    storageLog.info(`Storage completed: ${result.savedIds.length} saved, ${result.errorCount} errors`)
                })
                .catch((error: unknown) => {
                    jobLog.error(`Storage processing failed: ${error}`)
                })

            jobLog.info(`Storage task queued`)
        }

        return {
            success: true,
            count: results.length,
            data: { itemsCount: results.length },
        }
    } finally {
        if (page) {
            await page.close()
        }
    }
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
        browserPoolSize: parseInt(process.env.BROWSER_POOL_SIZE || '2'),
        storageQueueConcurrency: parseInt(process.env.STORAGE_QUEUE_CONCURRENCY || '3'),
    }

    log.info('Starting Crawler Service (with integrated storage)...')
    log.info(`Redis: ${config.redis.host}:${config.redis.port}`)
    log.info(`Concurrency: ${config.concurrency}`)
    log.info(`Browser Pool Size: ${config.browserPoolSize}`)
    log.info(`Storage Queue Concurrency: ${config.storageQueueConcurrency}`)

    const browserPool = new BrowserPool(config.browserPoolSize)
    await browserPool.init()

    const storageQueue = new PQueue({ concurrency: config.storageQueueConcurrency })

    const worker = createCrawlerWorker((job) => processCrawlerJob(job, browserPool, storageQueue), {
        connection: config.redis,
        concurrency: config.concurrency,
        limiter: {
            max: 10,
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
