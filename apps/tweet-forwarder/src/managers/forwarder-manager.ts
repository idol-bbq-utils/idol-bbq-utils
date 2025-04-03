import { Logger } from '@idol-bbq-utils/log'
import { Spider } from '@idol-bbq-utils/spider'
import { CronJob } from 'cron'
import EventEmitter from 'events'
import { BaseCompatibleModel, Droppable, TaskScheduler } from '@/utils/base'
import { AppConfig } from '@/types'
import { TaskType } from '@idol-bbq-utils/spider/types'
import DB, { Article, ArticleWithId } from '@/db'
import { BaseForwarder } from '@/middleware/forwarder/base'
import { MediaTool, MediaToolEnum } from '@/types/media'
import { Forwarder } from '@/types/forwarder'
import { getForwarder } from '@/middleware/forwarder'
import { createHash } from 'crypto'
import { cleanMediaFiles, galleryDownloadMediaFile, getMediaType, plainDownloadMediaFile } from '@/middleware/media'
import { formatTime } from '@/utils/time'
import { platformArticleMapToActionText } from '@idol-bbq-utils/spider/const'

const TAB = ' '.repeat(4)

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
        this.log = log?.child({ label: 'Forwarder Manager' })
        this.props = props
    }

    async init() {
        this.log?.info('Forwarder Manager initializing...')

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
            // 定时dispatch任务
            const job = new CronJob(cron as string, async () => {
                const taskId = `${Math.random().toString(36).substring(2, 9)}`
                this.log?.info(`[${taskId}] starting to dispatch task`)
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
            this.log?.info(`Task dispatcher stopped with cron: ${job.cronTime.source}`)
        })
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
        this.log?.debug(`[${taskId}] Task finished: ${JSON.stringify(result)}`)
        if (result.length > 0 && immediate_notify) {
            // TODO: notify forwarders by emitter
        }
    }
}

/**
 * Forward Target 会订阅
 */
class ForwarderPools extends BaseCompatibleModel implements Droppable {
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
     * - Article: website -> the forwarders subscribed to this website
     *
     * - Follows: batch id -> the forwarders subscribed to theses follows
     */
    private subscribers: Map<
        string,
        {
            to: Set<string>
            cfg_forwarder: Forwarder['cfg_forwarder']
        }
    > = new Map()
    private props: Pick<AppConfig, 'forward_targets' | 'cfg_forward_target'>
    // private workers:
    constructor(props: Pick<AppConfig, 'forward_targets' | 'cfg_forward_target'>, emitter: EventEmitter, log?: Logger) {
        super()
        this.log = log?.child({ label: this.NAME })
        this.emitter = emitter
        this.props = props
    }

    async init() {
        this.log?.info('Forwarder Pools initializing...')
        this.emitter.on(`forwarder:${TaskScheduler.TaskEvent.DISPATCH}`, this.onTaskReceived.bind(this))
        // create targets
        this.props.forward_targets?.forEach(async (t) => {
            const forwarderBuilder = getForwarder(t.platform)
            if (!forwarderBuilder) {
                this.log?.warn(`Forwarder not found for ${t.platform}`)
                return
            }
            const { block_until, replace_regex, ...restToBeHashed } = t.cfg_platform
            const forwarderToBeHashed = {
                ...t,
                cfg_platform: {
                    ...restToBeHashed,
                },
            }
            const id =
                t.id || `${t.platform}-${createHash('md5').update(JSON.stringify(forwarderToBeHashed)).digest('hex')}`
            const forwarder = new forwarderBuilder(t.cfg_platform, id, this.log)
            await forwarder.init()
            this.forward_to.set(id, forwarder)
        })
    }

    // handle task received
    async onTaskReceived({ taskId, task }: { taskId: string; task: TaskScheduler.Task }) {
        // prepare
        // maybe we will use workers in the future
        this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
            taskId,
            status: TaskScheduler.TaskStatus.RUNNING,
        })
        this.log?.debug(`[${taskId}] Task received: ${JSON.stringify(task)}`)
        let {
            websites,
            domain,
            paths,
            task_type = 'article' as TaskType,
            task_title,
            cfg_forwarder,
            subscribers,
        } = task.data as Forwarder
        if (!websites && !domain && !paths) {
            this.log?.error(`[${taskId}] No websites or domain or paths found`)
            this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.UPDATE_STATUS}`, {
                taskId,
                status: TaskScheduler.TaskStatus.CANCELLED,
            })
            return
        }
        if (!websites) {
            websites = paths?.map((path) => `${domain}${path}`) || []
        }

        try {
            let result: Array<CrawlerTaskResult> = []
            if (task_type === 'article') {
                await this.processArticleTask({
                    websites,
                    cfg_forwarder,
                    subscribers,
                    taskId,
                })
            }

            if (task_type === 'follows') {
                /**
                 * one time task id, so we basic needn't care about the collision next run
                 */
                const batchId = `${task_type}-${createHash('md5').update(JSON.stringify(task.data)).digest('hex')}`
                const forwarders = this.getOrInitForwarders(batchId, subscribers, cfg_forwarder)
                if (forwarders.length === 0) {
                    this.log?.warn(`[${taskId}] No forwarders found for ${task_title || batchId}`)
                    return
                }
                await this.processFollowsTask(websites, forwarders, cfg_forwarder)
            }

            this.emitter.emit(`forwarder:${TaskScheduler.TaskEvent.FINISHED}`, {
                taskId,
                result,
            } as TaskResult)
        } catch (error) {
            this.log?.error(`[${taskId}] Error while sending: ${error}`)
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

    async processArticleTask({
        websites,
        subscribers,
        cfg_forwarder,
        taskId,
    }: {
        websites: Array<string>
        subscribers: Forwarder['subscribers']
        cfg_forwarder: Forwarder['cfg_forwarder']
        taskId?: string
    }) {
        for (const website of websites) {
            // 单次爬虫任务
            const url = new URL(website)
            const forwarders = this.getOrInitForwarders(url.href, subscribers, cfg_forwarder)
            if (forwarders.length === 0) {
                this.log?.warn(`[${taskId || ''}] No forwarders found for ${url.href}`)
                continue
            }
            await this.processSingleArticleTask(url.href, forwarders, cfg_forwarder, taskId)
        }
    }

    async processSingleArticleTask(
        url: string,
        forwarders: Array<BaseForwarder>,
        cfg_forwarder: Forwarder['cfg_forwarder'],
        taskId?: string,
    ) {
        const { u_id, platform } = Spider.extractBasicInfo(url) ?? {}
        if (!u_id || !platform) {
            this.log?.error(`[${taskId || ''}] Invalid url: ${url}`)
            return
        }
        const articles = await DB.Article.getArticlesByName(u_id, platform)
        if (articles.length <= 0) {
            this.log?.warn(`[${taskId || ''}] No articles found for ${url}`)
            return
        }
        // 一篇文章可能需要被转发至多个平台，先获取一篇文章与forwarder的对应关系
        const articles_forwarders = [] as Array<{
            article: ArticleWithId
            to: Array<BaseForwarder>
        }>
        for (const article of articles) {
            const to = [] as Array<BaseForwarder>
            for (const f of forwarders) {
                const id = f.id
                const exist = await DB.ForwardBy.checkExist(article.id, id, 'article')
                if (!exist) {
                    to.push(f)
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
            this.log?.info(`[${taskId || ''}] No articles need to be sent for ${url}`)
            return
        }
        // 开始转发文章
        for (const { article, to } of articles_forwarders) {
            this.log?.debug(
                `[${taskId || ''}] Processing article ${article.a_id} for ${to.map((i) => i.id).join(', ')}`,
            )
            let maybe_media_files = [] as Array<{
                path: string
                media_type: string
            }>
            // article to photo

            // 下载媒体文件
            if (cfg_forwarder?.media) {
                const media = cfg_forwarder.media
                let paths = [] as Array<string>

                let currentArticle: Article | null = article
                while (currentArticle) {
                    let new_files = [] as Array<string>
                    if (currentArticle.has_media) {
                        this.log?.debug(`[${taskId || ''}] Downloading media files for ${currentArticle.a_id}`)
                        // handle media
                        if (media.use.tool === MediaToolEnum.DEFAULT && currentArticle.media) {
                            this.log?.debug(`[${taskId || ''}] Downloading media with http downloader`)
                            new_files = await Promise.all(
                                currentArticle.media?.map(({ url }) => plainDownloadMediaFile(url)),
                            )
                        }
                        if (media.use.tool === MediaToolEnum.GALLERY_DL) {
                            this.log?.debug(`[${taskId || ''}] Downloading media with gallery-dl`)
                            new_files = await galleryDownloadMediaFile(
                                currentArticle.url,
                                media.use as MediaTool<MediaToolEnum.GALLERY_DL>,
                            )
                        }
                        if (new_files.length > 0) {
                            this.log?.debug(`[${taskId || ''}] Downloaded media files: ${new_files.join(', ')}`)
                            paths = paths.concat(new_files)
                        }
                    }
                    currentArticle = currentArticle.ref
                }
                // maybe fallback to default
                maybe_media_files = paths.map((path) => ({
                    path,
                    media_type: getMediaType(path),
                }))
            }
            // 获取需要转发的文本，但如果已经执行了文本转图片，则只需要metaline
            const text = this.articleToText(article)
            // 对所有订阅者进行转发
            for (const target of to) {
                try {
                    this.log?.debug(`[${taskId || ''}] ${text.length} characters to be sent to ${target.id}`)
                    await target.send(text, {
                        media: maybe_media_files,
                        timestamp: article.created_at * 1000,
                    })
                    await DB.ForwardBy.save(article.id, target.id, 'article')
                } catch (e) {
                    this.log?.error(`[${taskId || ''}] Error while sending to ${target.id}: ${e}`)
                }
            }
            /**
             * 清理媒体文件
             */
            cleanMediaFiles(maybe_media_files.map((i) => i.path))
        }
    }

    async processFollowsTask(
        websites: Array<string>,
        forwarders: Array<BaseForwarder>,
        cfg_forwarder: Forwarder['cfg_forwarder'],
    ) {
        if (websites.length === 0) {
            this.log?.error(`No websites found`)
            return
        }
        const base_url = new URL(websites[0])
        let _websites = websites.map((i) => new URL(i)).filter((i) => i.hostname === base_url.hostname)

        // const follows = await this.getFollows(websites, cfg_forwarder)
        // if (follows.length === 0) {
        //     this.log?.warn(`No follows found for ${websites[0]}`)
        //     return
        // }
        // for (const forwarder of forwarders) {
        //     await forwarder.realSend(follows, {
        //         media: [],
        //         task_type: 'follows',
        //         task_title: `Follows from ${websites[0]}`,
        //     })
        // }
    }

    getOrInitForwarders(id: string, subscribers: Forwarder['subscribers'], cfg: Forwarder['cfg_forwarder']) {
        let wrap = this.subscribers.get(id)
        if (!wrap) {
            const newWrap = {
                to: new Set(subscribers || this.forward_to.keys()),
                cfg_forwarder: cfg,
            }
            this.subscribers.set(id, newWrap)
            wrap = newWrap
        }
        const { to } = wrap
        subscribers?.forEach((id) => {
            if (!to?.has(id)) {
                to.add(id)
            }
        })
        return Array.from(to)
            .map((id) => this.forward_to.get(id))
            .filter((i) => i !== undefined)
    }

    /**
     * 原文 -> 媒体文件alt -> extra
     */
    private articleToText(article: Article) {
        let currentArticle: Article | null = article
        let format_article = ''
        while (currentArticle) {
            const metaline = this.formatMetaline(currentArticle)
            format_article += `${metaline}`
            if (currentArticle.content) {
                format_article += '\n\n'
            }
            if (currentArticle.translated_by) {
                /***** 翻译原文 *****/
                let translation = currentArticle.translation || ''
                /***** 翻译原文结束 *****/

                /***** 图片描述翻译 *****/
                let media_translations: Array<string> = []
                for (const [idx, media] of (currentArticle.media || []).entries()) {
                    if (media.type === 'photo' && media.translation) {
                        media_translations.push(`图片${idx + 1} alt: ${media.translation as string}`)
                    }
                }
                if (media_translations.length > 0) {
                    translation = `${translation}\n\n${media_translations.join('\n')}`
                }
                /***** 图片描述结束 *****/

                /***** extra描述 *****/
                if (currentArticle.extra) {
                }
                /***** extra描述结束 *****/

                format_article += `${translation}\n${'-'.repeat(6)}↑${currentArticle.translated_by || '大模型' + '渣翻'}--↓原文${'-'.repeat(6)}\n`
            }

            /* 原文 */
            let raw_article = currentArticle.content
            let raw_alts = []
            for (const [idx, media] of (currentArticle.media || []).entries()) {
                if (media.type === 'photo' && media.alt) {
                    raw_alts.push(`photo${idx + 1} alt: ${media.alt as string}`)
                }
            }
            if (raw_alts.length > 0) {
                raw_article = `${raw_article}\n\n${raw_alts.join('\n')}`
            }
            if (currentArticle.extra) {
                // card parser
            }
            format_article += `${raw_article}`
            if (currentArticle.ref) {
                format_article += `\n\n${'-'.repeat(12)}\n\n`
            }
            // get ready for next run
            currentArticle = currentArticle.ref
        }
        return format_article
    }

    private formatMetaline(article: Article) {
        let metaline = [article.username, article.u_id].join(TAB) + '\n'
        metaline += [formatTime(article.created_at * 1000), ``].join(TAB)
        const action = platformArticleMapToActionText[article.platform][article.type]
        metaline += [formatTime(article.created_at * 1000), `${action}：`].join(TAB)
        return metaline
    }
}

export { ForwarderTaskScheduler, ForwarderPools }
