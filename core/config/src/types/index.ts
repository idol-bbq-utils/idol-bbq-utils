import type { TaskType } from '@idol-bbq-utils/spider/types'
import type { Crawler, CrawlerConfig } from './crawler'
import type { Sender, SenderConfig, SendTarget, SendTargetCommonConfig } from './sender'

interface QueueModeConfig {
    enabled: boolean
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
}

interface AppConfig {
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
    config?: {
        cfg_crawler?: CrawlerConfig
        cfg_sender?: SenderConfig
        cfg_send_target?: SendTargetCommonConfig
        queue?: QueueModeConfig
    }
}

export type { AppConfig, QueueModeConfig }
export * from './common'
export * from './crawler'
export * from './sender'
export * from './translator'
export * from './media'
