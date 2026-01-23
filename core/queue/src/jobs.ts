import type { Platform, TaskType, CrawlEngine, GenericArticle, GenericFollows } from '@idol-bbq-utils/spider/types'
import type { ForwardTargetPlatformEnum } from '@idol-bbq-utils/forwarder'

export interface ForwarderTarget {
    id: string
    platform: ForwardTargetPlatformEnum
    cfg_platform: Record<string, any>
    runtime_config?: Record<string, any>
}

export interface ForwarderConfig {
    targets: ForwarderTarget[]
    renderType?: 'text' | 'img' | 'img-with-meta'
    media?: {
        type: string
        use?: {
            tool: string
            path?: string
            cookieFile?: string
        }
    }
}

export interface CrawlerJobData {
    type: 'crawler'
    taskId: string
    crawlerName: string
    websites: string[]
    taskType: TaskType
    config: {
        engine?: CrawlEngine
        cookieFile?: string
        translator?: {
            provider: string
            apiKey: string
            config?: Record<string, unknown>
        }
        intervalTime?: {
            min: number
            max: number
        }
        userAgent?: string
        subTaskType?: string[]
    }
}

export type SpiderArticleResult = GenericArticle<Platform>

export type SpiderFollowsResult = GenericFollows

export type SpiderResult = SpiderArticleResult | SpiderFollowsResult

export interface StorageJobData {
    type: 'storage'
    taskId: string
    crawlerTaskId: string
    taskType: TaskType
    data: SpiderResult[]
    translatorConfig?: {
        provider: string
        apiKey: string
        config?: Record<string, unknown>
    }
}

export interface ForwarderJobData {
    type: 'forwarder'
    taskId: string
    storageTaskId: string
    articleIds: number[]
    urls: string[]
    forwarderConfig: ForwarderConfig
}

export type JobData = CrawlerJobData | StorageJobData | ForwarderJobData

export interface JobResult {
    success: boolean
    count?: number
    error?: string
    data?: unknown
}
