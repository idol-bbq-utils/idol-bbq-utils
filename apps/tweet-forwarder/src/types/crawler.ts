import { TaskType } from '@idol-bbq-utils/spider/types'
import { CommonCfgConfig } from './common'
import { Translator } from './translator'

interface CrawlerConfig extends CommonCfgConfig {
    /**
     * crontab format, reference: https://crontab.guru/
     *
     * Default: every 1 hour
     *
     *          * 1 * * *
     *          m h d M w
     */
    cron?: string
    /**
     * Path to the cookie file
     */
    cookie_file?: string
    /**
     * Random waiting time for per crawling
     */
    interval_time?: {
        max: number
        min: number
    }
    /**
     * Will trigger the immediate notify to subscribed forwarders after the crawling
     */
    immediate_notify?: boolean
    user_agent?: string
    translator?: Translator
}

interface Crawler {
    /**
     * will override the domain and paths
     */
    websites?: Array<string>
    /**
     * should work with paths
     */
    domain?: string
    /**
     * should work with domain
     */
    paths?: Array<string>
    /**
     * Task type defined in `@idol-bbq-utils/spider`
     */
    task_type?: TaskType
    /**
     *
     */
    cfg_crawler?: CrawlerConfig
}

export { Crawler, CrawlerConfig }
