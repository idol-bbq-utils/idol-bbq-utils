import type { TaskType } from '@idol-bbq-utils/spider/types'
import type { Crawler, CrawlerConfig } from './crawler'
import type { Forwarder, ForwarderConfig, ForwardTarget, ForwardTargetPlatformCommonConfig } from './forwarder'

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
    crawlers?: Array<Crawler>
    cfg_crawler?: CrawlerConfig
    forward_targets?: Array<ForwardTarget>
    cfg_forward_target?: ForwardTargetPlatformCommonConfig
    forwarders?: Array<Forwarder<TaskType>>
    cfg_forwarder?: ForwarderConfig
    queue?: QueueModeConfig
}

export type { AppConfig, QueueModeConfig }
