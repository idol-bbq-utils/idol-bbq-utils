import { IBot, IBotConfig } from './bot'
import { Crawler, CrawlerConfig } from './crawler'
import { Forwarder, ForwarderConfig, ForwarderTarget, ForwardTo } from './forwarder'

interface IYamlConfig {
    bots: Array<IBot>
    config?: IBotConfig
}

/**
 * only crawling or forwarding or both
 */
interface AppConfig {
    crawlers?: Array<Crawler> | Crawler
    cfg_crawler?: CrawlerConfig
    forward_targets?: Array<ForwarderTarget>
    forwarders?: Array<Forwarder>
    cfg_forwarder?: ForwarderConfig
    forward_to?: ForwardTo
}

export { IYamlConfig, AppConfig }
