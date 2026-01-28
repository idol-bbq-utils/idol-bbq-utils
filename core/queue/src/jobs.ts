import type { Platform, TaskType, GenericArticle, GenericFollows } from '@idol-bbq-utils/spider/types'
import type { TaskCrawler, TaskSender } from '@idol-bbq-utils/config'
import type { Translator } from '@idol-bbq-utils/translator'
import type { SendTarget } from '@idol-bbq-utils/sender'

interface JobMetadata {
    task_id: string
    task_type: TaskType
    name: string
}

export interface CrawlerJobData extends JobMetadata {
    type: 'crawler'
    websites: string[]
    config: Omit<TaskCrawler['config'], 'cron'>
}

export type SpiderArticleResult = GenericArticle<Platform>

export type SpiderFollowsResult = GenericFollows

export type SpiderResult = SpiderArticleResult | SpiderFollowsResult

export interface StorageJobData extends JobMetadata {
    type: 'storage'
    data: SpiderResult[]
    translator_config?: Translator
}

export interface SenderJobData extends JobMetadata {
    type: 'sender'
    websites: string[]
    task_title: string
    targets: Array<SendTarget>
    config: TaskSender['config']
}

export type JobData = CrawlerJobData | StorageJobData | SenderJobData

export interface JobResult {
    success: boolean
    count?: number
    error?: string
    data?: unknown
}
