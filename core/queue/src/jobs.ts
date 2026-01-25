import type { Platform, TaskType, GenericArticle, GenericFollows } from '@idol-bbq-utils/spider/types'
import type { CrawlerConfig, SenderConfig, SenderTaskConfig, SendTarget, TaskSenders, Translator } from '@idol-bbq-utils/config'

interface JobMetadata {
    task_id: string
    task_type: TaskType
    name: string
}

export interface CrawlerJobData extends JobMetadata {
    type: 'crawler'
    websites: string[]
    config: Omit<CrawlerConfig, 'cron'>
}

export type SpiderArticleResult = GenericArticle<Platform>

export type SpiderFollowsResult = GenericFollows

export type SpiderResult = SpiderArticleResult | SpiderFollowsResult

export interface StorageJobData extends JobMetadata {
    type: 'storage'
    crawler_task_id: string
    data: SpiderResult[]
    translator_config?: Translator
}

export interface SenderJobData extends JobMetadata {
    type: 'sender'
    websites: string[]
    task_title: string
    targets: Array<SendTarget>
    config: TaskSenders['config']
}

export type JobData = CrawlerJobData | StorageJobData | SenderJobData

export interface JobResult {
    success: boolean
    count?: number
    error?: string
    data?: unknown
}
