export { parseConfigFromFile, parseConfigFromString } from './parser'
export * from './types'
import merge from 'lodash.merge'
import type {
    AppConfigType,
    CrawlerConfig,
    SenderConfig,
    SendTargetCommonConfig,
    Crawler,
    Sender,
} from './types'
import type { TaskType } from '@idol-bbq-utils/spider/types'

export class AppConfig {
    constructor(private readonly app_config: AppConfigType) {}

    resolveCrawlerConfig(crawler: Crawler): CrawlerConfig {
        const global = this.app_config.config?.cfg_crawler || {}
        const task = crawler.config?.cfg_crawler || {}

        if (global.disable_overwrite) {
            return global
        }
        if (task.disable_overwrite) {
            return task
        }

        return merge({}, global, task)
    }

    /**
     * order: global -> task
     */
    resolveSenderConfig(sender: Sender<TaskType>): SenderConfig {
        const global = this.app_config.config?.cfg_sender || {}
        const task = sender.config?.cfg_sender || {}

        if (global.disable_overwrite) {
            return global
        }
        if (task.disable_overwrite) {
            return task
        }

        return merge({}, global, task)
    }

    /**
     * order: global -> target -> 
     */
    resolveSendTargetConfig(
        sender: Sender<TaskType>,
        targetId?: string | { id: string; cfg_send_target?: SendTargetCommonConfig },
    ): SendTargetCommonConfig {
        const global = this.app_config.config?.cfg_send_target || {}
        const task = sender.config?.cfg_send_target || {}
        const target = typeof targetId === 'string' ? {} : targetId?.cfg_send_target || {}
        if (global.disable_overwrite) {
            return global
        }
        if (task.disable_overwrite) {
            return task
        }

        return merge({}, global, task, target)
    }

    getSendTargets() {
        return this.app_config.send_targets || []
    }

    getSendTargetById(id: string) {
        return this.getSendTargets().find((target) => target.id === id)
    }

    getCrawlers() {
        return this.app_config.crawlers || []
    }

    getSenders() {
        return this.app_config.senders || []
    }

    getQueueConfig() {
        return this.app_config.config?.queue
    }

    getRawConfig() {
        return this.app_config
    }
}
