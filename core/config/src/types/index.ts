import type { PlatformNameMap, TaskType } from '@idol-bbq-utils/spider/types'
import type { Crawler, CrawlerConfig } from './crawler'
import type { Sender, SenderConfig } from './sender'
import type { SendTarget, SendTargetCommonConfig } from '@idol-bbq-utils/sender'
import type { Platform } from '@idol-bbq-utils/spider/types'

interface QueueConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
}

interface AccountConfig {
    /**
     * Unique name for the account
     */
    name: string
    platform: PlatformNameMap[Platform]
    cookie_string?: string
    cookie_file?: string
}

interface AppConfigType {
    /**
     * Task Crawler
     */
    crawlers?: Array<Crawler>
    /**
     * Task Sender
     */
    senders?: Array<Sender<TaskType>>
    /**
     * Send Targets Platforms like Telegram, QQ, etc.
     */
    send_targets?: Array<SendTarget>
    /**
     * Account configurations for the account pool
     */
    accounts?: Array<AccountConfig>
    config?: {
        cfg_crawler?: CrawlerConfig
        cfg_sender?: SenderConfig
        cfg_send_target?: SendTargetCommonConfig
        queue?: QueueConfig
    }
}

export type { AppConfigType, QueueConfig, AccountConfig }
export * from './crawler'
export * from './sender'
