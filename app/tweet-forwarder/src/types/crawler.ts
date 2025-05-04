import type { CrawlEngine, TaskType } from '@idol-bbq-utils/spider/types'
import type { CommonCfgConfig } from './common'
import type { Translator } from './translator'

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
     * TODO
     *
     * Will trigger the immediate notify to subscribed forwarders after the crawling
     *
     * Only works for `task_type` = `article` for now
     */
    immediate_notify?: boolean
    user_agent?: string
    translator?: Translator
    /**
     * Default use browser, it depends on the spider behavior.
     */
    engine?: CrawlEngine
    /**
     * 细粒度控制子任务类型
     *
     * 比如X的 article，需要分开爬取tweet和replies，具体设置依赖于爬虫的实现
     */
    sub_task_type?: Array<string>
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

export type { Crawler, CrawlerConfig }
