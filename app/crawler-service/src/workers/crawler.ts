import type {
    CrawlerJobData,
    JobResult,
    SpiderResult,
    SpiderArticleResult,
    SpiderFollowsResult,
} from '@idol-bbq-utils/queue/jobs'
import { spiderRegistry, parseNetscapeCookieToPuppeteerCookie } from '@idol-bbq-utils/spider'
import { type Job } from '@idol-bbq-utils/queue'
import { pRetry } from '@idol-bbq-utils/utils'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import crypto from 'crypto'
import tmp from 'tmp'
import type { Logger } from '@idol-bbq-utils/log'
import type PQueue from 'p-queue'
import { processArticleStorage, processFollowsStorage } from './storage'
import type { Platform } from '@idol-bbq-utils/spider/types'
import { accountPoolService } from '@idol-bbq-utils/account-pool'

// Task execution pool to prevent duplicate tasks
const executingTasks = new Set<string>()

export class BrowserPool {
    private browsers: Browser[] = []
    private tmpDirs: tmp.DirResult[] = []
    private currentIndex = 0
    private maxBrowsers: number
    private log?: Logger

    constructor(maxBrowsers: number = 1, log?: Logger) {
        this.maxBrowsers = maxBrowsers
        this.log = log
    }

    async init(): Promise<void> {
        this.log?.info(`Initializing browser pool with ${this.maxBrowsers} browsers...`)
        for (let i = 0; i < this.maxBrowsers; i++) {
            const tmpDir = tmp.dirSync({
                prefix: `puppeteer-${i}-`,
                unsafeCleanup: true,
            })
            this.tmpDirs.push(tmpDir)
            this.log?.info(`Browser ${i + 1} userDataDir: ${tmpDir.name}`)

            const browser = await puppeteer.launch({
                headless: true,
                args: [process.env.NO_SANDBOX ? '--no-sandbox' : '', '--disable-dev-shm-usage'].filter(Boolean),
                channel: 'chrome',
                userDataDir: tmpDir.name,
            })
            this.browsers.push(browser)
            this.log?.info(`Browser ${i + 1} launched`)
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
        this.log?.info('Closing browser pool...')
        await Promise.all(this.browsers.map((b) => b.close()))
        this.tmpDirs.forEach((tmpDir) => {
            try {
                tmpDir.removeCallback()
            } catch (error) {
                this.log?.warn(`Failed to cleanup tmpDir: ${error}`)
            }
        })
        this.log?.info('Browser pool closed')
    }
}

/**
 * Generate a unique task execution ID based on websites, task_type, and engine
 * Format: ${md5(sorted_websites)}::${task_type}::${engine}
 */
function generateTaskExecutionId(websites: string[], taskType: string, engine?: string): string {
    const sortedWebsites = [...websites].sort()
    const websitesStr = sortedWebsites.join(',')
    const hash = crypto.createHash('md5').update(websitesStr).digest('hex')
    return `${hash}::${taskType}::${engine || 'default'}`
}

export async function processCrawlerJob(
    job: Job<CrawlerJobData>,
    browserPool: BrowserPool,
    storageQueue: PQueue,
    log: Logger,
): Promise<JobResult> {
    const { task_id, task_type, name, websites, config } = job.data
    const jobLog = log.child({ trace_id: task_id, name })

    const executionId = generateTaskExecutionId(websites, task_type, config.engine)

    if (executingTasks.has(executionId)) {
        jobLog.warn(`Task already executing: ${executionId}, skipping duplicate job`)
        return {
            success: false,
            error: `Duplicate task already executing: ${executionId}`,
        }
    }

    executingTasks.add(executionId)
    jobLog.info(`Task execution started: ${executionId} (pool size: ${executingTasks.size})`)

    jobLog.info(`Processing crawler job: ${websites.length} websites`)

    let page: Page | undefined
    const results: SpiderResult[] = []

    try {
        const needsBrowser = !config.engine?.startsWith('api')
        if (needsBrowser) {
            page = await browserPool.getPage()
            await page.setUserAgent(config.user_agent)
        }

        for (const website of websites) {
            let currentAccount: any = null
            try {
                const plugin = spiderRegistry.findByUrl(website)
                if (!plugin) {
                    jobLog.warn(`Spider not found for ${website}`)
                    continue
                }

                const spider = plugin.create(jobLog)
                const { platform } = spiderRegistry.extractBasicInfo(website) as { u_id: string; platform: Platform }
                let cookie_string = ''
                
                if (config.auth === 'cookie') {
                    currentAccount = await accountPoolService.getAccount(platform, config.auth_account)
                    if (!currentAccount) {
                        jobLog.warn(`No available account for platform ${platform}, skipping ${website}`)
                        continue
                    }
                    cookie_string = currentAccount.cookie_string || ''
                    const cookies = parseNetscapeCookieToPuppeteerCookie(cookie_string)
                    if (page && cookies.length > 0) {
                        await page.browserContext().setCookie(...cookies)
                        jobLog.info(`Set ${cookies.length} cookies for ${website} using account ${currentAccount.name}`)
                    }
                }

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
                if (currentAccount) {
                    await accountPoolService.releaseAccount(currentAccount.id)
                    await accountPoolService.reportAccountSuccess(currentAccount.id)
                }

                await job.updateProgress(((websites.indexOf(website) + 1) / websites.length) * 100)
                
            } catch (error) {
                jobLog.error(`Error crawling ${website}: ${error}`)
                let is_account_error = false;
                if (error instanceof Error) {
                    is_account_error = is_account_error || (error.message.includes('authentication failed') ||
                        error.message.includes('login required') ||
                        error.message.includes('invalid cookie') ||
                        error.message.includes('forbidden'))
                }
                if (error instanceof String) {
                    is_account_error = is_account_error || (error.includes('authentication failed') ||
                        error.includes('login required') ||
                        error.includes('invalid cookie') ||
                        error.includes('forbidden'))
                }

                if (currentAccount && is_account_error) {
                    await accountPoolService.releaseAccount(currentAccount.id)
                    await accountPoolService.reportAccountFailure(currentAccount.id, 30)
                    jobLog.warn(`Reported failure for account ${currentAccount.name} (id: ${currentAccount.id})`)
                }
            }
        }

        if (results.length > 0) {
            jobLog.info(`Dispatching ${results.length} items to internal storage queue`)
            storageQueue
                .add(async () => {
                    const storageLog = log.child({ trace_id: `${task_id}-storage`, task_type })
                    storageLog.info(`Processing storage: ${results.length} items (type: ${task_type})`)

                    let result: { savedIds: number[]; errorCount: number }

                    if (task_type === 'article') {
                        result = await processArticleStorage(results as SpiderArticleResult[], config.translator, storageLog)
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
        executingTasks.delete(executionId)
        jobLog.info(`Task execution completed: ${executionId} (pool size: ${executingTasks.size})`)
    }
}
