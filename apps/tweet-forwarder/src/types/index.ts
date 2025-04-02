import { Crawler, CrawlerConfig } from './crawler'
import {
    Forwarder,
    ForwarderConfig,
    ForwarderTarget,
    ForwardTo,
    ForwardToPlatformConfig,
    ForwardToPlatformEnum,
} from './forwarder'

/**
 * only crawling or forwarding or both
 */
interface AppConfig {
    crawlers?: Array<Crawler>
    cfg_crawler?: CrawlerConfig
    forward_targets?: Array<ForwarderTarget>
    cfg_forward_target?: ForwardToPlatformConfig<ForwardToPlatformEnum>
    forwarders?: Array<Forwarder>
    cfg_forwarder?: ForwarderConfig
}

export { AppConfig }
