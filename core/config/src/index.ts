export { parseConfigFromFile, parseConfigFromString } from './parser'
export * from './types'
import merge from 'lodash.merge'
import type {
    AppConfigType,
    CrawlerConfig,
    SenderConfig,
    Crawler,
    Sender, 
} from './types'
import { sanitizeWebsites } from '@idol-bbq-utils/utils'
import type { TaskType } from '@idol-bbq-utils/spider/types'
import { UserAgent } from '@idol-bbq-utils/spider'
import { type SendTargetCommonConfig, type SendTarget, type SenderTaskConfig, MediaToolEnum} from '@idol-bbq-utils/sender'

type SpecifiedCrawlerConfig = Required<Pick<CrawlerConfig, 'cron' | 'interval_time' | 'user_agent'>> & Omit<CrawlerConfig, 'cron' | 'interval_time' | 'user_agent'>
type SpecifiedSenderConfig = Required<Pick<SenderConfig, 'cron' | 'render_type'>> & Omit<SenderConfig, 'cron' | 'render_type'>

type TaskCrawler = {
    name: string
    websites: Array<string>
    task_type: TaskType
    config: SpecifiedCrawlerConfig
}

type TaskSender = {
    name: string
    websites: Array<string>
    task_title: string
    task_type: TaskType
    targets: Array<SendTarget>
    config: {
        cfg_task?: SenderTaskConfig<TaskType>
        cfg_sender: SpecifiedSenderConfig
    }
}

export class AppConfig {
    static DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
        cron: '*/30 * * * *',
        interval_time: {
            min: 1000,
            max: 15000,
        },
        user_agent: UserAgent.CHROME,
    }

    static DEFAULT_SEND_TARGET_CONFIG: SendTargetCommonConfig = {
        block_until: '2h',
    }

    static DEFAULT_SENDER_CONFIG: TaskSender['config'] = {
        cfg_task: {
            follows: {
                comparison_window: '1d',
            },
        } as SenderTaskConfig<'follows'>,
        cfg_sender: {
            cron: '*/15 * * * *',
            render_type: 'img-with-meta',
            media: {
                type: 'no-storage',
                use: {
                    tool: MediaToolEnum.DEFAULT,
                }
            }
        },
    }

    private task_crawlers: Array<TaskCrawler> = []
    private task_senders: Array<TaskSender> = []
    /**
     * key is id, should be unique
     */
    private send_targets: Map<string, SendTarget> = new Map()
    constructor(private readonly raw_config: AppConfigType) {
        this.resolveConfig()
    }

    // Merge global and task level config
    public resolveConfig(): void {
        this.task_crawlers = []
        this.task_senders = []
        this.send_targets.clear()
        this.task_crawlers = this.resolveTaskCrawlers()
        this.send_targets = this.resolveSendTargets()
        this.task_senders = this.resolveTaskSenders(this.send_targets)
    }

    private resolveCrawlerConfig(crawler: Crawler): SpecifiedCrawlerConfig {
        const global = this.raw_config.config?.cfg_crawler || {}
        let resolved_cfg = merge({}, AppConfig.DEFAULT_CRAWLER_CONFIG, global) as SpecifiedCrawlerConfig
        if (global.disable_overwrite) {
            return resolved_cfg
        }
        resolved_cfg = merge({}, resolved_cfg, crawler.config?.cfg_crawler || {})
        if (crawler.config?.cfg_crawler?.disable_overwrite) {
            return resolved_cfg
        }
        return resolved_cfg
    }

    private resolveTaskCrawlers(): Array<TaskCrawler> {
        const crawlers = this.raw_config.crawlers || []
        const resolved_crawlers: Array<TaskCrawler> = []
        for (const crawler of crawlers) {
            const resolved_cfg = this.resolveCrawlerConfig(crawler)
            const websites = sanitizeWebsites({
                websites: crawler.websites || [],
                origin: crawler.origin,
                paths: crawler.paths,
            })
            resolved_crawlers.push({
                name: crawler.name || '',
                websites: websites,
                task_type: crawler.task_type || 'article',
                config: resolved_cfg,
            })
        }
        return resolved_crawlers
    }

    /**
     * order: global -> target -> sender unified cfg -> sender target runtime cfg
     */
    private resolveSendTargetConfig(
        target: SendTarget,
        sender_unified_cfg?: SendTargetCommonConfig,
        target_runtime_cfg?: SendTargetCommonConfig,
    ): SendTarget['config'] {
        const global = this.raw_config.config?.cfg_send_target || {}
        let resolved_cfg = merge({}, AppConfig.DEFAULT_SEND_TARGET_CONFIG, global)
        if (global.disable_overwrite) {
            return resolved_cfg
        }
        resolved_cfg = merge({}, resolved_cfg, target.config || {})
        if (target.config?.disable_overwrite) {
            return resolved_cfg
        }
        resolved_cfg = merge({}, resolved_cfg, sender_unified_cfg || {})
        if (sender_unified_cfg?.disable_overwrite) {
            return resolved_cfg
        }
        resolved_cfg = merge({}, resolved_cfg, target_runtime_cfg || {})
        if (target_runtime_cfg?.disable_overwrite) {
            return resolved_cfg
        }
        return resolved_cfg
    }

    private resolveSendTargets(): Map<string, SendTarget> {
        const targets = this.raw_config.send_targets || []
        const resolved_targets: Map<string, SendTarget> = new Map()
        for (const target of targets) {
            const resolved_cfg = this.resolveSendTargetConfig(target)
            const resolved_target: SendTarget = {
                platform: target.platform,
                id: target.id,
                config: resolved_cfg,
            }
            const key = target.id
            if (resolved_targets.has(key)) {
                throw new Error(`Duplicate send target key: ${key}`)
            }
            resolved_targets.set(key, resolved_target)
        }

        return resolved_targets
    }

    /**
     * order: global -> task
     */
    private resolveSenderConfig(sender: Sender<TaskType>): TaskSender['config'] {
        const global = {
            cfg_sender: this.raw_config.config?.cfg_sender || {},
        } as Exclude<TaskSender['config'], undefined>
        let resolved_cfg = merge({}, AppConfig.DEFAULT_SENDER_CONFIG, global)
        if (global.cfg_sender?.disable_overwrite) {
            return resolved_cfg
        }
        resolved_cfg = merge({}, resolved_cfg, sender.config || {})
        if (sender.config?.cfg_sender?.disable_overwrite) {
            return resolved_cfg
        }
        return resolved_cfg
    }

    // especially handle targets here
    private resolveTaskSenders(targets: Map<string, SendTarget>): Array<TaskSender> {
        const senders = this.raw_config.senders || []
        const resolved_senders: Array<TaskSender> = []
        for (const sender of senders) {
            const resolved_sender_cfg = this.resolveSenderConfig(sender)
            const resolved_targets: Array<SendTarget> = []
            if (sender.targets && sender.targets.length > 0) {
                const sender_unified_cfg = sender.config?.cfg_send_target
                for (const target_ref of sender.targets) {
                    let target_id: string
                    let runtime_cfg: SendTargetCommonConfig | undefined
                    if (typeof target_ref === 'string') {
                        target_id = target_ref
                    } else {
                        target_id = target_ref.id
                        runtime_cfg = target_ref.cfg_send_target
                    }
                    const target_key = target_id
                    const target = targets.get(target_key)
                    if (!target) {
                        throw new Error(`Send target not found: ${target_key}`)
                    }
                    const merged_cfg = this.resolveSendTargetConfig(target, sender_unified_cfg, runtime_cfg)
                    const merged_c: SendTarget = {
                        platform: target.platform,
                        id: target.id,
                        config: merged_cfg,
                    }
                    resolved_targets.push(merged_c)
                }
            }
            const websites = sanitizeWebsites({
                websites: sender.websites || [],
                origin: sender.origin,
                paths: sender.paths,
            })
            resolved_senders.push({
                name: sender.name || '',
                websites: websites,
                task_type: sender.task_type || 'article',
                task_title: resolved_sender_cfg.cfg_task?.task_title || '',
                targets: resolved_targets,
                config: resolved_sender_cfg,
            })
        }
        return resolved_senders
    }

    public getTaskCrawlers(): Array<TaskCrawler> {
        return this.task_crawlers
    }

    public getTaskSenders(): Array<TaskSender> {
        return this.task_senders
    }

    public getSendTargets(): Array<SendTarget> {
        return Array.from(this.send_targets.values())
    }

    public getRawConfig(): AppConfigType {
        return this.raw_config
    }
}

export type { TaskCrawler, TaskSender, SpecifiedCrawlerConfig, SpecifiedSenderConfig }