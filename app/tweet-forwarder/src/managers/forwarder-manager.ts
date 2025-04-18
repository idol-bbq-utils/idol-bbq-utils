import { Logger } from '@idol-bbq-utils/log'
import { Spider } from '@idol-bbq-utils/spider'
import { CronJob } from 'cron'
import EventEmitter from 'events'
import { BaseCompatibleModel, sanitizeWebsites, TaskScheduler } from '@/utils/base'
import type { AppConfig } from '@/types'
import { Platform, type MediaType, type TaskType } from '@idol-bbq-utils/spider/types'
import DB from '@/db'
import type { Article, ArticleWithId, DBFollows } from '@/db'
import { BaseForwarder } from '@/middleware/forwarder/base'
import { type MediaTool, MediaToolEnum } from '@/types/media'
import type { ForwardToPlatformCommonConfig, Forwarder as RealForwarder } from '@/types/forwarder'
import { getForwarder } from '@/middleware/forwarder'
import crypto from 'crypto'
import { galleryDownloadMediaFile, getMediaType, plainDownloadMediaFile, writeImgToFile } from '@/middleware/media'
import { articleToText, followsToText, formatMetaline, ImgConverter } from '@idol-bbq-utils/render'
import { existsSync, unlinkSync } from 'fs'
import dayjs from 'dayjs'
import { orderBy } from 'lodash'

type Forwarder = RealForwarder<TaskType>

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
class ForwarderTaskScheduler extends TaskScheduler.TaskScheduler {
    NAME: string = 'ForwarderTaskScheduler'
    protected log?: Logger
    private props: Pick<AppConfig, 'cfg_forwarder' | 'forwarders'>

    constructor(props: Pick<AppConfig, 'cfg_forwarder' | 'forwarders'>, emitter: EventEmitter, log?: Logger) {
        super(emitter)
        this.log = log?.child({ subservice: this.NAME })
        this.props = props
    }

    async init() {
        this.log?.info('initializing...')

        if (!this.props.forwarders) {
            this.log?.warn('Forwarder not found, skipping...')
            return
        }

        // 注册基本的监听器
        for (const [eventName, listener] of Object.entries(this.taskHandlers)) {
            this.emitter.on(`forwarder:${eventName}`, listener)
        }

        // 遍历爬虫配置，为每个爬虫创建定时任务
        for (const forwarder of this.props.forwarders) {
            forwarder.cfg_forwarder = {
                cron: '*/30 * * * *',
                media: {
                    type: 'no-storage',
                    use: {
                        tool: MediaToolEnum.DEFAULT,
                    },
                },
                ...this.props.cfg_forwarder,
                ...forwarder.cfg_forwarder,
            }
            const { cron } = forwarder.cfg_forwarder
            const { task_title, name } = forwarder
            // 定时dispatch任务
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`starting to dispatch task ${[name, task_title].filter(Boolean).join(' ')}...`)
                const task: TaskScheduler.Task = {
                    id: taskId,
                    status: TaskScheduler.TaskStatus.PENDING,
                    data: forwarder,
                }
                this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.DISPATCH}`, {
                    taskId,
                    task: task,
                })
                this.tasks.set(taskId, task)
            })
            this.log?.debug(`Task dispatcher created with detail: ${JSON.stringify(forwarder)}`)
            this.cronJobs.push(job)
        }
    }

    /**
     * 启动定时任务
     */
    async start() {
        this.log?.info('Manager starting...')
        this.cronJobs.forEach((job) => {
            job.start()
        })
    }

    /**
     * 停止定时任务管理器
     */
    async stop() {
        // force to stop all tasks

        // stop all cron jobs
        this.cronJobs.forEach((job) => {
            job.stop()
        })
        this.log?.info('All jobs stopped')
        this.log?.info('Manager stopped')
    }

    async drop() {
        // 清除所有任务
        this.tasks.clear()
        this.emitter.removeAllListeners()
        this.log?.info('Manager dropped')
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
        this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.COMPLETED,
        })
        this.log?.info(`[${taskId}] Task finished.`)
        if (result.length > 0 && immediate_notify) {
            // TODO: notify forwarders by emitter
        }
    }
}

type ForwardToIdWithRuntimeConfig = Record<string, ForwardToPlatformCommonConfig | undefined>
type ForwardToInstanceWithRuntimeConfig = {
    forwarder: BaseForwarder
    runtime_config?: ForwardToPlatformCommonConfig
}
class ForwarderPools extends BaseCompatibleModel {
    NAME = 'ForwarderPools'
    log?: Logger
    private emitter: EventEmitter
    /**
     * Mapping from `forwarder id` to `forwarder instance`
     *
     * ```
     * const id =  id or `${platform}-${hash(forwarderToBeHashed)}`
     * const forwarderToBeHashed =
     * {
     *     platform: Platform,
     *     id?: string,
     *     cfg_platform: {
     *         replace_regex?: ...,     // this will not be hashed
     *         block_until?: ...,       // this will not be hashed
     *         ...others
     *     }
     * }
     * ```
     */
    private forward_to: Map<string, BaseForwarder> = new Map()
    /**
     * - Article: batch id -> the forwarders subscribed to this website
     *
     * - Follows: batch id -> the forwarders subscribed to theses follows
     */
    private subscribers: Map<
        string,
        {
            /**
             * id for forward_to
             */
            to: ForwardToIdWithRuntimeConfig
            cfg_forwarder: Forwarder['cfg_forwarder']
        }
    > = new Map()
    private props: Pick<AppConfig, 'forward_targets' | 'cfg_forward_target'>
    private ArticleConverter = new ImgConverter()
    // private workers:
    constructor(props: Pick<AppConfig, 'forward_targets' | 'cfg_forward_target'>, emitter: EventEmitter, log?: Logger) {
        super()
        this.log = log?.child({ subservice: this.NAME })
        this.emitter = emitter
        this.props = props
    }

    async init() {
        this.log?.info('Forwarder Pools initializing...')
        this.emitter.on(`forwarder:${TaskScheduler.TaskEvent.DISPATCH}`, this.onTaskReceived.bind(this))
        // create targets
        const { cfg_forward_target } = this.props
        this.props.forward_targets?.forEach(async (t) => {
            const forwarderBuilder = getForwarder(t.platform)
            if (!forwarderBuilder) {
                this.log?.warn(`Forwarder not found for ${t.platform}`)
                return
            }
            t.cfg_platform = {
                ...cfg_forward_target,
                ...t.cfg_platform,
            }
            const { block_until, replace_regex, ...restToBeHashed } = t.cfg_platform
            const forwarderToBeHashed = {
                ...t,
                cfg_platform: {
                    ...restToBeHashed,
                },
            }
            const id =
                t.id ||
                `${t.platform}-${crypto.createHash('md5').update(JSON.stringify(forwarderToBeHashed)).digest('hex')}`
            const forwarder = new forwarderBuilder(t.cfg_platform, id, this.log)
            await forwarder.init()
            this.forward_to.set(id, forwarder)
        })
    }

    // handle task received
    async onTaskReceived(ctx: TaskScheduler.TaskCtx) {
        const { taskId, task } = ctx
        let {
            websites,
            origin,
            paths,
            task_type = 'article' as TaskType,
            task_title,
            cfg_forwarder,
            name,
            subscribers,
            cfg_forward_target,
        } = task.data as Forwarder
        ctx.log = this.log?.child({ label: name, trace_id: taskId })
        // prepare
        // maybe we will use workers in the future
        this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.RUNNING,
        })
        ctx.log?.debug(`Task received: ${JSON.stringify(task)}`)

        if (!websites && !origin && !paths) {
            ctx.log?.error(`No websites or origin or paths found`)
            this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
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

        try {
            let result: Array<CrawlerTaskResult> = []
            if (task_type === 'article') {
                await this.processArticleTask({
                    taskId,
                    log: ctx.log,
                    task: {
                        ...ctx.task,
                        data: {
                            websites,
                            cfg_forwarder,
                            subscribers,
                            cfg_forward_target,
                        },
                    },
                })
            }

            if (task_type === 'follows') {
                /**
                 * one time task id, so we basic needn't care about the collision next run
                 */
                const batchId = crypto
                    .createHash('md5')
                    .update(`${task_type}:${websites.join(',')}`)
                    .digest('hex')
                const forwarders = this.getOrInitForwarders(batchId, subscribers, cfg_forwarder)
                if (forwarders.length === 0) {
                    ctx.log?.warn(`No forwarders found for ${task_title || batchId}`)
                    return
                }
                await this.processFollowsTask(ctx, websites, forwarders)
            }

            this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.FINISHED}`, {
                taskId,
                result,
            } as TaskResult)
        } catch (error) {
            ctx.log?.error(`Error while sending: ${error}`)
            this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.FAILED,
            })
        }
    }

    async drop(...args: any[]): Promise<void> {
        this.log?.info('Dropping Pools...')
        this.emitter.removeAllListeners()
        this.log?.info('Pools dropped')
    }

    async processArticleTask(ctx: TaskScheduler.TaskCtx) {
        const { websites, subscribers, cfg_forwarder, cfg_forward_target } = ctx.task.data as {
            websites: Array<string>
            subscribers: Forwarder['subscribers']
            cfg_forwarder: Forwarder['cfg_forwarder']
            cfg_forward_target: Forwarder['cfg_forward_target']
        }
        const batchId = crypto
            .createHash('md5')
            .update(`article:${websites.join(',')}`)
            .digest('hex')
        for (const website of websites) {
            // 单次爬虫任务
            const url = new URL(website)
            const forwarders = this.getOrInitForwarders(batchId, subscribers, cfg_forwarder, cfg_forward_target)
            if (forwarders.length === 0) {
                continue
            }
            /**
             * 查询当前网站下的近10篇文章并查询转发
             */
            await this.processSingleArticleTask(ctx, url.href, forwarders, cfg_forwarder)
        }
    }

    async processSingleArticleTask(
        ctx: TaskScheduler.TaskCtx,
        url: string,
        forwarders: Array<ForwardToInstanceWithRuntimeConfig>,
        cfg_forwarder: Forwarder['cfg_forwarder'],
    ) {
        const { u_id, platform } = Spider.extractBasicInfo(url) ?? {}
        if (!u_id || !platform) {
            ctx.log?.error(`Invalid url: ${url}`)
            return
        }
        const articles = await DB.Article.getArticlesByName(u_id, platform)
        if (articles.length <= 0) {
            ctx.log?.warn(`No articles found for ${url}`)
            return
        }
        /**
         * 一篇文章可能需要被转发至多个平台，先获取一篇文章与forwarder的对应关系
         */
        const articles_forwarders = [] as Array<{
            article: ArticleWithId
            to: Array<ForwardToInstanceWithRuntimeConfig>
        }>
        for (const article of articles) {
            const to = [] as Array<ForwardToInstanceWithRuntimeConfig>
            for (const forwarder of forwarders) {
                const { forwarder: f } = forwarder
                const id = f.id
                /**
                 * 同一个宏任务循环中，此时可能会有同一个网站运行了两次及以上的定时任务，此时checkExist都是false
                 */
                const exist = await DB.ForwardBy.checkExist(article.id, id, 'article')
                if (!exist) {
                    to.push(forwarder)
                }
            }
            if (to.length > 0) {
                articles_forwarders.push({
                    article,
                    to,
                })
            }
        }

        if (articles_forwarders.length === 0) {
            ctx.log?.debug(`No articles need to be sent for ${url}`)
            return
        }
        ctx.log?.info(`Ready to send articles for ${url}`)
        // 开始转发文章
        for (const { article, to } of articles_forwarders) {
            let articleToImgSuccess = false
            ctx.log?.debug(`Processing article ${article.a_id} for ${to.map((i) => i.forwarder.id).join(', ')}`)
            let maybe_media_files = [] as Array<{
                path: string
                media_type: MediaType
            }>
            if (cfg_forwarder?.render_type === 'img') {
                try {
                    const imgBuffer = await this.ArticleConverter.articleToImg(article, process.env.FONTS_DIR)
                    ctx.log?.debug(`Converted article ${article.a_id} to img successfully`)
                    const path = writeImgToFile(imgBuffer, `${ctx.taskId}-${article.a_id}-rendered.png`)

                    maybe_media_files.push({
                        path,
                        media_type: 'photo',
                    })
                    articleToImgSuccess = true
                } catch (e) {
                    ctx.log?.error(`Error while converting article to img: ${e}`)
                }
            }
            // article to photo

            // 下载媒体文件
            if (cfg_forwarder?.media) {
                const media = cfg_forwarder.media

                let currentArticle: Article | null = article
                while (currentArticle) {
                    let new_files = [] as Array<{
                        path: string
                        media_type: MediaType
                    }>
                    if (currentArticle.has_media) {
                        ctx.log?.debug(`Downloading media files for ${currentArticle.a_id}`)
                        // handle media
                        if (media.use.tool === MediaToolEnum.DEFAULT && currentArticle.media) {
                            ctx.log?.debug(`Downloading media with http downloader`)
                            new_files = await Promise.all(
                                currentArticle.media?.map(async ({ url, type }) => {
                                    const path = await plainDownloadMediaFile(url, ctx.taskId)
                                    return {
                                        path,
                                        media_type: type,
                                    }
                                }),
                            )

                            if (currentArticle.extra?.media) {
                                const extra_files = await Promise.all(
                                    currentArticle.extra.media.map(async ({ url, type }) => {
                                        const path = await plainDownloadMediaFile(url, ctx.taskId)
                                        return {
                                            path,
                                            media_type: type,
                                        }
                                    }),
                                )
                                new_files = new_files.concat(extra_files)
                            }
                        }
                        if (media.use.tool === MediaToolEnum.GALLERY_DL) {
                            ctx.log?.debug(`Downloading media with gallery-dl`)
                            new_files = await galleryDownloadMediaFile(
                                currentArticle.url,
                                media.use as MediaTool<MediaToolEnum.GALLERY_DL>,
                            ).map((path) => ({
                                path,
                                media_type: getMediaType(path),
                            }))
                            if (currentArticle.extra?.media) {
                                const extra_files = await Promise.all(
                                    currentArticle.extra.media.map(async ({ url }) => {
                                        const path = await plainDownloadMediaFile(url, ctx.taskId)
                                        return {
                                            path,
                                            media_type: getMediaType(path),
                                        }
                                    }),
                                )
                                new_files = new_files.concat(extra_files)
                            }
                        }
                        if (new_files.length > 0) {
                            ctx.log?.debug(`Downloaded media files: ${new_files.join(', ')}`)
                            maybe_media_files = maybe_media_files.concat(new_files)
                        }
                    }
                    currentArticle = currentArticle.ref
                }
            }
            const fullText = articleToText(article)
            // 获取需要转发的文本，但如果已经执行了文本转图片，则只需要metaline
            const text = articleToImgSuccess ? formatMetaline(article) : fullText
            // 对所有订阅者进行转发
            for (const { forwarder: target, runtime_config } of to) {
                ctx.log?.info(`Sending article ${article.a_id} from ${article.u_id} to ${target.NAME}`)
                try {
                    await target.send(text, {
                        media: maybe_media_files,
                        timestamp: article.created_at,
                        runtime_config,
                        original_text: articleToImgSuccess ? fullText : undefined,
                    })
                    let currentArticle: ArticleWithId | null = article
                    while (currentArticle) {
                        await DB.ForwardBy.save(currentArticle.id, target.id, 'article')
                        currentArticle = currentArticle.ref as ArticleWithId | null
                    }
                } catch (e) {
                    ctx.log?.error(`Error while sending to ${target.id}: ${e}`)
                }
            }
            /**
             * 清理媒体文件
             */
            maybe_media_files
                .map((i) => i.path)
                .forEach((path) => {
                    try {
                        if (existsSync(path)) {
                            unlinkSync(path)
                        }
                    } catch (e) {
                        ctx.log?.error(`Error while unlinking file ${path}: ${e}`)
                    }
                })
        }
    }

    /**
     * 一次性任务，并不需要保存转发状态
     */
    async processFollowsTask(
        ctx: TaskScheduler.TaskCtx,
        websites: Array<string>,
        forwarders: Array<ForwardToInstanceWithRuntimeConfig>,
    ) {
        if (websites.length === 0) {
            ctx.log?.error(`No websites found`)
            return
        }
        const { task_title, cfg_task } = ctx.task.data as RealForwarder<'follows'>
        const { comparison_window = '1d' } = cfg_task || {}
        const results = new Map<Platform, Array<[DBFollows, DBFollows | null]>>()
        // 我们假设websites的网页并不完全相同，所以我们需要分类
        for (const website of websites) {
            const url = new URL(website)
            const { platform, u_id } = Spider.extractBasicInfo(url.href) ?? {}
            if (!platform || !u_id) {
                ctx.log?.error(`Invalid url: ${url.href}`)
                continue
            }
            const follows = await DB.Follow.getLatestAndComparisonFollowsByName(u_id, platform, comparison_window)
            if (!follows) {
                ctx.log?.warn(`No follows found for ${url.href}`)
                continue
            }
            let result = results.get(platform)
            if (!result) {
                result = []
                results.set(platform, result)
            }
            result.push(follows)
        }

        if (results.size === 0) {
            ctx.log?.warn(`No follows need to be sent ${task_title}`)
            return
        }

        // 开始转发
        let texts_to_send = followsToText(orderBy(Array.from(results.entries()), (i) => i[0], 'asc'))
        if (task_title) {
            texts_to_send = `${task_title}\n${texts_to_send}`
        }
        for (const { forwarder: target, runtime_config } of forwarders) {
            try {
                await target.send(texts_to_send, {
                    timestamp: dayjs().unix(),
                    runtime_config,
                })
                /**
                 * 假设follows并不需要保存转发状态，因为任务基本上是一天一次
                 */
                // for (const [_, follows] of results.entries()) {
                //     for (const [cur, _] of follows) {
                //         await DB.ForwardBy.save(cur.id, target.id, 'follows')
                //     }
                // }
            } catch (e) {
                ctx.log?.error(`Error while sending to ${target.id}: ${e}`)
            }
        }
    }

    /**
     * 通过 batch id 来获取或初始化转发器
     * 如果没有找到，则新创建一个映射
     * 并注册新的订阅者
     */
    getOrInitForwarders(
        id: string,
        subscribers: Forwarder['subscribers'],
        cfg: Forwarder['cfg_forwarder'],
        cfg_forward_target?: Forwarder['cfg_forward_target'],
    ): Array<ForwardToInstanceWithRuntimeConfig> {
        const common_cfg = cfg_forward_target
        let wrap = this.subscribers.get(id)
        if (!wrap) {
            const newWrap = {
                to: subscribers
                    ? subscribers.reduce((acc, s) => {
                          if (typeof s === 'string') {
                              acc[s] = common_cfg
                          }
                          if (typeof s === 'object') {
                              acc[s.id] = {
                                  ...common_cfg,
                                  ...s.cfg_forward_target,
                              }
                          }
                          return acc
                      }, {} as ForwardToIdWithRuntimeConfig)
                    : this.forward_to.keys().reduce((acc, id) => {
                          acc[id] = undefined
                          return acc
                      }, {} as ForwardToIdWithRuntimeConfig),
                cfg_forwarder: cfg,
            }
            this.subscribers.set(id, newWrap)
            wrap = newWrap
        }
        const { to } = wrap
        /**
         * 注册新的订阅者
         */
        subscribers?.forEach((s) => {
            const id = typeof s === 'string' ? s : s.id
            if (!(id in to)) {
                to[id] =
                    typeof s === 'string'
                        ? common_cfg
                        : {
                              ...common_cfg,
                              ...s.cfg_forward_target,
                          }
            }
        })
        return Object.entries(to)
            .map(([id, cfg]) => {
                const forwarder = this.forward_to.get(id)
                if (!forwarder) {
                    return undefined
                }
                return {
                    forwarder,
                    runtime_config: cfg,
                }
            })
            .filter((i) => i !== undefined)
    }
}

export { ForwarderTaskScheduler, ForwarderPools }
