import { Crawler, CrawlerConfig } from './crawler'
import { Forwarder, ForwarderConfig, ForwardTo, ForwardToPlatformCommonConfig } from './forwarder'

/**
 * only crawling or forwarding or both
 */
interface AppConfig {
    crawlers?: Array<Crawler>
    cfg_crawler?: CrawlerConfig
    forward_targets?: Array<ForwardTo>
    cfg_forward_target?: ForwardToPlatformCommonConfig
    forwarders?: Array<Forwarder>
    cfg_forwarder?: ForwarderConfig
}

export { AppConfig }
