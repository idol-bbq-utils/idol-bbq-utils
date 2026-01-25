import type { TaskType } from '@idol-bbq-utils/spider/types'
import type { Crawler, CrawlerConfig } from './crawler'
import type { Sender, SenderConfig } from './sender'
import type { SendTarget, SendTargetCommonConfig } from '@idol-bbq-utils/sender'

interface QueueConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
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
    config?: {
        cfg_crawler?: CrawlerConfig
        cfg_sender?: SenderConfig
        cfg_send_target?: SendTargetCommonConfig
        queue?: QueueConfig
    }
}

export type { AppConfigType, QueueConfig }
export * from './crawler'
export * from './sender'
