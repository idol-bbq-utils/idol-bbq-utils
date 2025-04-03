import { Logger } from '@idol-bbq-utils/log'
import { Spider, parseNetscapeCookieToPuppeteerCookie, UserAgent } from '@idol-bbq-utils/spider'
import { Page } from 'puppeteer-core'
import { Browser } from 'puppeteer-core'
import { CronJob } from 'cron'
import { BaseTranslator, TRANSLATION_ERROR_FALLBACK } from '@/middleware/translator/base'
import EventEmitter from 'events'
import { BaseCompatibleModel, sanitizeWebsites, TaskScheduler } from '@/utils/base'
import { Crawler } from '@/types/crawler'
import { AppConfig } from '@/types'
import { TaskType } from '@idol-bbq-utils/spider/types'
import { BaseSpider } from 'node_modules/@idol-bbq-utils/spider/lib/spiders/base'
import { TranslatorProvider } from '@/types/translator'
import { getTranslator } from '@/middleware/translator'
import { pRetry } from '@idol-bbq-utils/utils'
import DB, { Article } from '@/db'
import { RETRY_LIMIT } from '@/config'
import crypto from 'crypto'

interface TaskResult {
    taskId: string
    result: Array<CrawlerTaskResult>
    immediate_notify?: boolean
}

interface CrawlerTaskResult {
    task_type: TaskType
    url: string
    data: Array<number>
}

/**
 * 根据cronjob dispatch任务
 * 根据结果查询数据库
 */
class SpiderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'SpiderTaskScheduler'
    protected log?: Logger
    private props: Pick<AppConfig, 'crawlers' | 'cfg_crawler'>

    constructor(props: Pick<AppConfig, 'crawlers' | 'cfg_crawler'>, emitter: EventEmitter, log?: Logger) {
        super(emitter)
        this.props = props
        this.log = log?.child({ label: this.NAME })
    }

    async init() {
        this.log?.info('Manager initializing...')

        if (!this.props.crawlers) {
            this.log?.warn('Crawler not found, skipping...')
            return
        }

        // 注册基本的监听器
        for (const [eventName, listener] of Object.entries(this.taskHandlers)) {
            this.emitter.on(`spider:${eventName}`, listener)
        }

        // 遍历爬虫配置，为每个爬虫创建定时任务
        for (const crawler of this.props.crawlers) {
            crawler.cfg_crawler = {
                cron: '*/30 * * * *',
                ...this.props.cfg_crawler,
                ...crawler.cfg_crawler,
            }
            const { cron } = crawler.cfg_crawler
            // 定时dispatch任务
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`[${taskId}] starting to dispatch task`)
                const task: TaskScheduler.Task = {
                    id: taskId,
                    status: TaskScheduler.TaskStatus.PENDING,
                    data: crawler,
                }
                this.emitter.emit(`spider:${TaskScheduler.TaskEvent.DISPATCH}`, {
                    taskId,
                    task: task,
                })
                this.tasks.set(taskId, task)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(crawler)}`)
            this.cronJobs.push(job)
        }
    }

    /**
     * 启动爬虫管理器
     */
    async start() {
        this.log?.info('Manager starting...')
        this.cronJobs.forEach((job) => {
            job.start()
        })
    }

    /**
     * 停止爬虫管理器
     */
    async stop() {
        // force to stop all tasks

        // stop all cron jobs
        this.cronJobs.forEach((job) => {
            job.stop()
            this.log?.info(`Task dispatcher stopped with cron: ${job.cronTime.source}`)
        })
        this.log?.info('Manager stopped')
    }

    async drop() {
        // 清除所有任务
        this.tasks.clear()
        this.emitter.removeAllListeners()
        this.log?.info('Spider Manager dropped')
    }

    updateTaskStatus({ taskId, status }: { taskId: string; status: TaskScheduler.TaskStatus }) {
        const task = this.tasks.get(taskId)
        if (task) {
            task.status = status
        }

        // TODO: delete task later or manually
        if (status === TaskScheduler.TaskStatus.COMPLETED || status === TaskScheduler.TaskStatus.FAILED) {
            this.tasks.delete(taskId)
        }
    }

    finishTask({ taskId, result, immediate_notify }: TaskResult) {
        this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.COMPLETED,
        })
        this.log?.info(`[${taskId}] Task finished.`)
        if (result.length > 0 && immediate_notify) {
            // TODO: notify forwarders by emitter
        }
    }
}

class SpiderPools extends BaseCompatibleModel {
    NAME = 'SpiderPools'
    log?: Logger
    private emitter: EventEmitter
    private translators: Map<TranslatorProvider, BaseTranslator> = new Map()
    private browser: Browser
    /**
     * batch id =  md5hash( `websites` or `origin + paths`)
     */
    private pools: Map<
        string,
        Map<
            string,
            {
                spider: BaseSpider
                page: Page
            }
        >
    > = new Map()
    // private workers:
    constructor(browser: Browser, emitter: EventEmitter, log?: Logger) {
        super()
        this.browser = browser
        this.log = log?.child({ label: 'Spider Pools' })
        this.emitter = emitter
    }

    async init() {
        this.log?.info('Spider Pools initializing...')
        this.emitter.on(`spider:${TaskScheduler.TaskEvent.DISPATCH}`, this.onTaskReceived.bind(this))
    }

    // handle task received
    async onTaskReceived(ctx: TaskScheduler.TaskCtx) {
        const { taskId, task, log } = ctx
        ctx.log = this.log?.child({ trace_id: taskId })
        // prepare
        // maybe we will use workers in the future
        this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.RUNNING,
        })
        ctx.log?.debug(`Task received: ${JSON.stringify(task)}`)
        let { websites, origin, paths, task_type = 'article', cfg_crawler } = task.data as Crawler
        let { one_time: one_time_task } = cfg_crawler || {}
        if (['follows'].includes(task_type) && one_time_task !== false) {
            one_time_task = true
        }
        if (!websites && !origin && !paths) {
            ctx.log?.error(`No websites or origin or paths found`)
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.CANCELLED,
            })
            return
        }
        websites = sanitizeWebsites({
            websites,
            origin,
            paths,
        })
        // try to get translation
        let translator = undefined
        if (cfg_crawler?.translator) {
            const translator_cfg = cfg_crawler.translator
            translator = this.translators.get(translator_cfg.provider)
            if (!translator) {
                const translatorBuilder = getTranslator(translator_cfg.provider)
                if (translatorBuilder) {
                    translator = new translatorBuilder(translator_cfg.api_key, this.log, translator_cfg.cfg_translator)
                    await translator.init()
                    this.translators.set(translator_cfg.provider, translator)
                    ctx.log?.info(`Translator instance created for ${translator_cfg.provider}`)
                } else {
                    ctx.log?.warn(`Translator not found for ${translator_cfg.provider}`)
                }
            }
        }
        try {
            let result: Array<CrawlerTaskResult> = []
            // 准备任务
            const batchId = crypto
                .createHash('md5')
                .update(`${task_type}:${websites.join(',')}`)
                .digest('hex')
            let pool = this.pools.get(batchId)
            if (!pool) {
                pool = new Map()
                this.pools.set(batchId, pool)
            }

            // 开始任务
            for (const website of websites) {
                // 单次系列爬虫任务
                const url = new URL(website)
                let wrap = pool.get(url.hostname)
                if (!wrap) {
                    // 需要用详细的网页地址匹配
                    const spiderBuilder = await Spider.getSpider(url.href)
                    if (!spiderBuilder) {
                        ctx.log?.warn(`Spider not found for ${url.href}`)
                        continue
                    }
                    const spider = new spiderBuilder(this.log).init()
                    const page = await this.browser.newPage()
                    const cookie_file = cfg_crawler?.cookie_file
                    const user_agent = cfg_crawler?.user_agent
                    cookie_file && (await page.setCookie(...parseNetscapeCookieToPuppeteerCookie(cookie_file)))
                    await page.setUserAgent(user_agent || UserAgent.CHROME)
                    wrap = {
                        spider,
                        page,
                    }
                    pool.set(url.hostname, wrap)
                    ctx.log?.info(`Spider instance created for ${url.hostname}`)
                }
                // dynamically setting cookie_file and user_agent
                const { spider, page } = wrap

                if (task_type === 'article') {
                    let saved_article_ids = await this.crawlArticle(ctx, spider, url, page, translator)

                    result.push({
                        task_type: 'article',
                        url: url.href,
                        data: saved_article_ids,
                    })
                }

                if (task_type === 'follows') {
                    const follows = await pRetry(async () => spider.crawl(url.href, page, 'follows'), {
                        retries: RETRY_LIMIT,
                    })
                    let saved_follows_id = (await DB.Follow.save(follows)).id
                    result.push({
                        task_type: 'follows',
                        url: url.href,
                        data: [saved_follows_id],
                    })
                }
            }

            // 任务收尾
            // 一次性任务
            if (one_time_task) {
                ctx.log?.info(`One time task finished, closing all pages...`)
                pool.forEach(async (wrap) => {
                    const { page } = wrap
                    await page.close()
                })
                this.pools.delete(batchId)
            }
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.FINISHED}`, {
                taskId,
                result,
                immediate_notify: cfg_crawler?.immediate_notify,
            } as TaskResult)
        } catch (error) {
            ctx.log?.error(`Error while crawling: ${error}`)
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.FAILED,
            })
        }
    }

    async drop(...args: any[]): Promise<void> {
        this.log?.info('Dropping Spider Pools...')
        // close all pages
        for (const [id, spiders] of this.pools.entries()) {
            for (const [origin, wrap] of spiders.entries()) {
                const { page } = wrap
                await page.close()
                this.log?.info(`Page closed for ${origin}`)
            }
        }
        this.pools.clear()
        this.translators.clear()
        this.emitter.removeAllListeners()
        await this.browser.close()
        this.log?.info('Browser closed')
        this.log?.info('Spider Pools dropped')
    }

    private async crawlArticle(
        ctx: TaskScheduler.TaskCtx,
        spider: BaseSpider,
        url: URL,
        page: Page,
        translator?: BaseTranslator,
    ): Promise<Array<number>> {
        const articles = await pRetry(async () => spider.crawl(url.href, page, 'article'), {
            retries: RETRY_LIMIT,
            onFailedAttempt: (error) => {
                ctx.log?.error(
                    `[${url.href}] Crawl article failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                )
            },
        })
        let new_articles: Array<Article> = []
        let saved_article_ids = []
        for (const article of articles) {
            const isExist = await DB.Article.checkExist(article)
            if (!isExist) {
                new_articles.push(article)
            }
        }

        new_articles = await Promise.all(new_articles.map((article) => this.doTranslate(ctx, article, translator)))

        // 串行，防止create unique的问题
        for (const article of new_articles) {
            const res = await DB.Article.trySave(article)
            saved_article_ids.push(res)
        }
        return saved_article_ids.filter((i) => i !== undefined).map((i) => i.id) as Array<number>
    }

    private async doTranslate(
        ctx: TaskScheduler.TaskCtx,
        article: Article,
        translator?: BaseTranslator,
    ): Promise<Article> {
        if (!translator) {
            return article
        }
        ctx.log?.info(`[${article.a_id}] Translating article...`)
        let currentArticle: Article | null = article
        while (currentArticle) {
            const { a_id, platform } = currentArticle
            // maybe the ref article translated failed
            const article_maybe_translated = await DB.Article.getByArticleCode(a_id, platform)
            if (currentArticle.content && !BaseTranslator.isValidTranslation(article_maybe_translated?.translation)) {
                const content = currentArticle.content
                const content_translation = await pRetry(() => translator.translate(content), {
                    retries: RETRY_LIMIT,
                    onFailedAttempt: (error) => {
                        ctx.log?.warn(
                            `[${a_id}] Translation content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                        )
                    },
                })
                    .then((res) => res)
                    .catch((err) => {
                        ctx.log?.error(`[${a_id}] Error while translating content: ${err}`)
                        return TRANSLATION_ERROR_FALLBACK
                    })
                ctx.log?.debug(`[${a_id}] Translation content: ${content_translation}`)
                currentArticle.translation = content_translation
                currentArticle.translated_by = translator.NAME
            }

            if (currentArticle.media) {
                for (const [idx, media] of currentArticle.media.entries()) {
                    // 假设图片与描述的顺序是一致的
                    if (
                        media.alt &&
                        !BaseTranslator.isValidTranslation(
                            (article_maybe_translated?.media as unknown as Article['media'])?.[idx]?.translation,
                        )
                    ) {
                        const alt = media.alt
                        const caption_translation = await await pRetry(() => translator.translate(alt), {
                            retries: RETRY_LIMIT,
                            onFailedAttempt: (error) => {
                                ctx.log?.warn(
                                    `[${a_id}] Translation media alt failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                )
                            },
                        })
                            .then((res) => res)
                            .catch((err) => {
                                ctx.log?.error(`[${a_id}] Error while translating media alt: ${err}`)
                                return TRANSLATION_ERROR_FALLBACK
                            })
                        media.translation = caption_translation
                        media.translated_by = translator.NAME
                    }
                }
            }

            // TODO
            if (currentArticle.extra) {
            }
            currentArticle = currentArticle.ref
        }
        return article
    }
}

export { SpiderTaskScheduler, SpiderPools }
