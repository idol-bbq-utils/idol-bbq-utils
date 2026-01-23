import { createLogger } from '@idol-bbq-utils/log'
import { createCrawlerWorker, QueueManager, QueueName, type Job } from '@idol-bbq-utils/queue'
import type { CrawlerJobData, JobResult, ArticleData, StorageJobData } from '@idol-bbq-utils/queue/jobs'
import { spiderRegistry, parseNetscapeCookieToPuppeteerCookie, UserAgent } from '@idol-bbq-utils/spider'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { pRetry } from '@idol-bbq-utils/utils'
import tmp from 'tmp'

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

async function processCrawlerJob(
    job: Job<CrawlerJobData>,
    browserPool: BrowserPool,
    queueManager: QueueManager,
): Promise<JobResult> {
    const { taskId, crawlerName, websites, taskType, config } = job.data
    const jobLog = log.child({ taskId, crawlerName })

    jobLog.info(`Processing crawler job: ${websites.length} websites`)

    let page: Page | undefined
    const allArticles: ArticleData[] = []

    try {
        const needsBrowser = !config.engine?.startsWith('api')

        if (needsBrowser) {
            page = await browserPool.getPage()
            await page.setUserAgent(config.userAgent || UserAgent.CHROME)

            if (config.cookieFile) {
                const cookies = parseNetscapeCookieToPuppeteerCookie(config.cookieFile)
                await page.browserContext().setCookie(...cookies)
            }
        }

        let cookieString: string | undefined
        if (config.cookieFile) {
            const cookies = parseNetscapeCookieToPuppeteerCookie(config.cookieFile)
            cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
        }

        for (const website of websites) {
            try {
                const plugin = spiderRegistry.findByUrl(website)
                if (!plugin) {
                    jobLog.warn(`Spider not found for ${website}`)
                    continue
                }

                const spider = plugin.create(jobLog)

                if (config.intervalTime) {
                    const delay = Math.floor(
                        Math.random() * (config.intervalTime.max - config.intervalTime.min) + config.intervalTime.min,
                    )
                    jobLog.debug(`Waiting ${delay}ms before crawling...`)
                    await new Promise((r) => setTimeout(r, delay))
                }

                const articles = await pRetry(
                    () =>
                        spider.crawl(website, page, taskId, {
                            task_type: taskType,
                            crawl_engine: config.engine,
                            sub_task_type: config.subTaskType,
                            cookieString,
                        }),
                    {
                        retries: 3,
                        onFailedAttempt: (error) => {
                            jobLog.warn(
                                `Crawl failed for ${website}, ${error.retriesLeft} retries left: ${error.message}`,
                            )
                        },
                    },
                )

                if (Array.isArray(articles)) {
                    allArticles.push(...(articles as ArticleData[]))
                }
                jobLog.info(`Crawled ${website}: ${Array.isArray(articles) ? articles.length : 1} items`)

                await job.updateProgress(((websites.indexOf(website) + 1) / websites.length) * 100)
            } catch (error) {
                jobLog.error(`Error crawling ${website}: ${error}`)
            }
        }

        if (allArticles.length > 0) {
            const storageQueue = queueManager.getQueue(QueueName.STORAGE)
            const storageJobData: StorageJobData = {
                type: 'storage',
                taskId: `${taskId}-storage`,
                crawlerTaskId: taskId,
                articles: allArticles,
            }
            await storageQueue.add('store', storageJobData, {
                jobId: `${taskId}-storage`,
            })
            jobLog.info(`Dispatched ${allArticles.length} articles to storage queue`)
        }

        return {
            success: true,
            count: allArticles.length,
            data: { articlesCount: allArticles.length },
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
    }

    log.info('Starting Crawler Service...')
    log.info(`Redis: ${config.redis.host}:${config.redis.port}`)
    log.info(`Concurrency: ${config.concurrency}`)
    log.info(`Browser Pool Size: ${config.browserPoolSize}`)

    const browserPool = new BrowserPool(config.browserPoolSize)
    await browserPool.init()

    const queueManager = new QueueManager({ redis: config.redis })

    const worker = createCrawlerWorker((job) => processCrawlerJob(job, browserPool, queueManager), {
        connection: config.redis,
        concurrency: config.concurrency,
        limiter: {
            max: 10,
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

    log.info('Crawler Service started, waiting for jobs...')

    async function shutdown() {
        log.info('Shutting down...')
        await worker.close()
        await queueManager.close()
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
