import type { TaskType } from '@idol-bbq-utils/spider/types'
import type { Crawler, CrawlerConfig } from './crawler'
import type { Forwarder, ForwarderConfig, ForwardTo, ForwardToPlatformCommonConfig } from './forwarder'

/**
 * only crawling or forwarding or both
 */
interface AppConfig {
    crawlers?: Array<Crawler>
    cfg_crawler?: CrawlerConfig
    forward_targets?: Array<ForwardTo>
    cfg_forward_target?: ForwardToPlatformCommonConfig
    forwarders?: Array<Forwarder<TaskType>>
    cfg_forwarder?: ForwarderConfig
}

export type { AppConfig }
