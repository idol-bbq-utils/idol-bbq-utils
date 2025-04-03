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
     *
     * Only works for `task_type` = `article` for now
     */
    immediate_notify?: boolean
    user_agent?: string
    /**
     * if true, scheduler will destroy the page after the crawling
     *
     * if false, scheduler will keep the page alive for the whole time
     *
     * for some (`follows`) task type, the one_time default is true
     */
    one_time?: boolean
    translator?: Translator
}

interface Crawler {
    /**
     * Display only
     */
    name?: string
    /**
     * will override the origin and paths
     */
    websites?: Array<string>
    /**
     * should work with paths
     */
    origin?: string
    /**
     * should work with origin
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
