import { Logger } from '@idol-bbq-utils/log'
import { Spider, parseNetscapeCookieToPuppeteerCookie, UserAgent } from '@idol-bbq-utils/spider'
import { Page } from 'puppeteer-core'
import { Browser } from 'puppeteer-core'
import { CronJob } from 'cron'
import { BaseTranslator, TRANSLATION_ERROR_FALLBACK } from '@/middleware/translator/base'
import EventEmitter from 'events'
import { BaseCompatibleModel, sanitizeWebsites, TaskScheduler } from '@/utils/base'
import type { Crawler } from '@/types/crawler'
import type { AppConfig } from '@/types'
import type { Platform, TaskType, TaskTypeResult } from '@idol-bbq-utils/spider/types'
import { BaseSpider } from '@idol-bbq-utils/spider'
import { TranslatorProvider } from '@/types/translator'
import { getTranslator } from '@/middleware/translator'
import { pRetry } from '@idol-bbq-utils/utils'
import DB from '@/db'
import type { Article } from '@/db'
import { RETRY_LIMIT } from '@/config'
import { delay } from '@/utils/time'
import { shuffle } from 'lodash'
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
        this.log = log?.child({ subservice: this.NAME })
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
            let { interval_time, cron } = crawler.cfg_crawler
            // 定时dispatch任务
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`[${taskId}] Starting to dispatch task: ${crawler.name}`)
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
    private translators: Map<string, BaseTranslator> = new Map()
    private browser: Browser
    /**
     * BaseSpider._VALID_URL.source
     */
    private spiders: Map<string, BaseSpider> = new Map()
    // private workers:
    constructor(browser: Browser, emitter: EventEmitter, log?: Logger) {
        super()
        this.browser = browser
        this.log = log?.child({ subservice: this.NAME })
        this.emitter = emitter
    }

    async init() {
        this.log?.info('Spider Pools initializing...')
        this.emitter.on(`spider:${TaskScheduler.TaskEvent.DISPATCH}`, this.onTaskReceived.bind(this))
    }

    // handle task received
    async onTaskReceived(ctx: TaskScheduler.TaskCtx) {
        const { taskId, task } = ctx
        let { websites, origin, paths, task_type = 'article', cfg_crawler, name } = task.data as Crawler
        ctx.log = this.log?.child({ label: name, trace_id: taskId })
        // prepare
        // maybe we will use workers in the future
        this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.RUNNING,
        })
        ctx.log?.debug(`Task received: ${JSON.stringify(task)}`)
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
        // TODO: configurable id
        const crawler_batch_id = crypto
            .createHash('md5')
            .update(`${websites.join(',')}`)
            .digest('hex')

        // shuffle it for avoiding bot detection
        websites = shuffle(websites)
        if (websites.length === 0) {
            ctx.log?.error(`No websites found after sanitizing`)
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.CANCELLED,
            })
            return
        }

        let { translator: _translator, interval_time } = cfg_crawler || {}
        // try to get translation
        let translator = undefined
        if (_translator) {
            const translator_cfg = _translator
            translator = this.translators.get(crawler_batch_id)
            if (!translator) {
                const translatorBuilder = getTranslator(translator_cfg.provider)
                if (translatorBuilder) {
                    translator = new translatorBuilder(translator_cfg.api_key, this.log, translator_cfg.cfg_translator)
                    await translator.init()
                    this.translators.set(crawler_batch_id, translator)
                    ctx.log?.info(`Translator instance created for ${translator_cfg.provider}`)
                } else {
                    ctx.log?.warn(`Translator not found for ${translator_cfg.provider}`)
                }
            }
        }

        let cookieString: string | undefined
        let page: Page | undefined

        const cookie_file = cfg_crawler?.cookie_file
        if (cookie_file) {
            const cookies = parseNetscapeCookieToPuppeteerCookie(cookie_file)
            cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
        }

        const user_agent = cfg_crawler?.user_agent

        interval_time = {
            ...{
                max: 0,
                min: 0,
            },
            ...interval_time,
        }
        const time = Math.floor(Math.random() * (interval_time.max - interval_time.min) + interval_time.min)

        let result: Array<CrawlerTaskResult> = []
        let errors: Array<any> = []

        try {
            // 开始任务
            for (const website of websites) {
                this.log?.info(`[${taskId}] crawler wait for ${time}ms`)
                await delay(time)
                // 单次系列爬虫任务
                try {
                    const url = new URL(website)
                    const spiderBuilder = await Spider.getSpider(url.href)
                    if (!spiderBuilder) {
                        ctx.log?.warn(`Spider not found for ${url.href}`)
                        continue
                    }
                    let spider = this.spiders.get(spiderBuilder._VALID_URL.source)
                    if (!spider) {
                        spider = new spiderBuilder(this.log).init()
                        this.spiders.set(spiderBuilder._VALID_URL.source, spider)
                        ctx.log?.info(`Spider instance created for ${url.hostname}`)
                    }

                    const crawl_engine = cfg_crawler?.engine
                    const needsBrowser = !crawl_engine?.startsWith('api')

                    if (needsBrowser && !page) {
                        ctx.log?.info(`Creating browser page for engine: ${crawl_engine || 'browser'}`)
                        page = await this.browser.newPage()
                        await page.setUserAgent(user_agent || UserAgent.CHROME)

                        if (cookie_file) {
                            await page.browserContext().setCookie(...parseNetscapeCookieToPuppeteerCookie(cookie_file))
                        }
                    } else if (!needsBrowser) {
                        ctx.log?.debug(`Using API engine: ${crawl_engine}, no page needed`)
                    }

                    if (task_type === 'article') {
                        let saved_article_ids = await this.crawlArticle(
                            ctx,
                            spider,
                            url,
                            page,
                            translator,
                            cookieString,
                        )

                        result.push({
                            task_type: 'article',
                            url: url.href,
                            data: saved_article_ids,
                        })
                    }

                    if (task_type === 'follows') {
                        const sub_task_type = cfg_crawler?.sub_task_type
                        const follows_res = (await pRetry(
                            () =>
                                spider.crawl(url.href, page, taskId, {
                                    task_type: 'follows',
                                    crawl_engine,
                                    sub_task_type,
                                    cookieString,
                                }),
                            {
                                retries: RETRY_LIMIT,
                                onFailedAttempt: (error) => {
                                    ctx.log?.error(
                                        `[${url.href}] Crawl follows failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                    )
                                },
                            },
                        )) as TaskTypeResult<'follows', Platform>
                        for (const follows of follows_res) {
                            let saved_follows_id = (await DB.Follow.save(follows)).id
                            result.push({
                                task_type: 'follows',
                                url: url.href,
                                data: [saved_follows_id],
                            })
                        }
                    }
                } catch (error) {
                    ctx.log?.error(`Error while crawling for ${website}: ${error}`)
                    errors.push(error)
                    continue
                }
            }
        } finally {
            if (page) {
                await page.close()
                ctx.log?.info('Browser page closed')
            }
        }

        if (errors.length > 0) {
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.FAILED,
            })
        } else {
            this.emitter.emit(`spider:${TaskScheduler.TaskEvent.FINISHED}`, {
                taskId,
                result,
                immediate_notify: cfg_crawler?.immediate_notify,
            } as TaskResult)
        }
    }

    async drop(...args: any[]): Promise<void> {
        this.log?.info('Dropping Spider Pools...')
        this.spiders.clear()
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
        page?: Page,
        translator?: BaseTranslator,
        cookieString?: string,
    ): Promise<Array<number>> {
        const { cfg_crawler } = ctx.task.data as Crawler
        const { engine, sub_task_type } = cfg_crawler || {}
        const articles = await pRetry(
            () =>
                spider.crawl(url.href, page, ctx.taskId, {
                    task_type: 'article',
                    crawl_engine: engine,
                    sub_task_type,
                    cookieString,
                }),
            {
                retries: RETRY_LIMIT,
                onFailedAttempt: (error) => {
                    ctx.log?.error(
                        `[${url.href}] Crawl article failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                    )
                },
            },
        )
        let new_articles: Array<Article> = []
        let saved_article_ids = []
        for (const article of articles) {
            const isExist = await DB.Article.checkExist(article)
            if (!isExist) {
                new_articles.push(article)
            }
        }
        if (new_articles.length === 0) {
            ctx.log?.info(`[${url.href}] No new articles found.`)
            return []
        }
        /**
         * 非常耗时，如何解决
         */
        new_articles = await Promise.all(new_articles.map((article) => this.doTranslate(ctx, article, translator)))

        // 串行，防止create unique的问题
        for (const article of new_articles) {
            /**
             * TODO 这里可以尝试更新翻译
             */
            const res = await DB.Article.trySave(article)
            saved_article_ids.push(res)
        }
        ctx.log?.info(`[${url.href}] ${saved_article_ids.length} articles saved.`)
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
        const { username } = article
        ctx.log?.info(`[${username}] [${article.a_id}] Translating article...`)
        let currentArticle: Article | null = article
        /**
         * 先获取所有引用文章的指针，flat为数组，对数组进行await Promise.all操作
         * 再根据是否需要更新翻译进行更新
         */
        let articleNeedTobeTranslated: Array<Article> = []
        // 获取引用文章
        while (currentArticle && typeof currentArticle === 'object') {
            articleNeedTobeTranslated.push(currentArticle)
            if (typeof currentArticle.ref !== 'string') {
                currentArticle = currentArticle.ref as Article
            } else {
                currentArticle = null
            }
        }
        /**
         * 并行翻译
         * 通过文章引用来修改对应文章的翻译
         */
        ctx.log?.info(
            `[${username}] [${article.a_id}] Starting batch translating ${articleNeedTobeTranslated.length} articles...`,
        )
        await Promise.all(
            articleNeedTobeTranslated.map(async (currentArticle) => {
                const { a_id, username, platform } = currentArticle
                // maybe the ref article translated failed
                const article_maybe_translated = await DB.Article.getByArticleCode(a_id, platform)
                if (
                    currentArticle.content &&
                    !BaseTranslator.isValidTranslation(article_maybe_translated?.translation)
                ) {
                    const content = currentArticle.content
                    ctx.log?.info(`[${username}] [${a_id}] Starting to translate...`)
                    const content_translation = await pRetry(() => translator.translate(content), {
                        retries: RETRY_LIMIT,
                        onFailedAttempt: (error) => {
                            ctx.log?.warn(
                                `[${username}] [${a_id}] Translation content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                            )
                        },
                    })
                        .then((res) => res)
                        .catch((err) => {
                            ctx.log?.error(`[${username}] [${a_id}] Error while translating content: ${err}`)
                            return TRANSLATION_ERROR_FALLBACK
                        })
                    ctx.log?.debug(`[${username}] [${a_id}] Translation content: ${content_translation}`)
                    ctx.log?.info(`[${username}] [${a_id}] Translation complete.`)
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
                                        `[${username}] [${a_id}] Translation media alt failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                    )
                                },
                            })
                                .then((res) => res)
                                .catch((err) => {
                                    ctx.log?.error(`[${username}] [${a_id}] Error while translating media alt: ${err}`)
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
                            retries: RETRY_LIMIT,
                            onFailedAttempt: (error) => {
                                ctx.log?.warn(
                                    `[${username}] [${a_id}] Translation extra content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                )
                            },
                        })
                            .then((res) => res)
                            .catch((err) => {
                                ctx.log?.error(`[${username}] [${a_id}] Error while translating extra content: ${err}`)
                                return TRANSLATION_ERROR_FALLBACK
                            })
                        extra_ref.translation = content_translation
                        extra_ref.translated_by = translator.NAME
                    }
                }
            }),
        )
        ctx.log?.info(`[${username}] [${article.a_id}] ${articleNeedTobeTranslated.length} Articles are translated.`)
        return article
    }
}

export { SpiderTaskScheduler, SpiderPools }
