import type { Platform, TaskType, CrawlEngine } from '@idol-bbq-utils/spider/types'

export interface ForwarderConfig {
    targets: string[]
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

export interface ArticleData {
    platform: Platform
    a_id: string
    u_id: string
    username: string
    content: string
    translation?: string
    translated_by?: string
    url: string
    type: string
    created_at: number
    has_media: boolean
    media?: Array<{ url: string; type: string; alt?: string }>
    ref?: unknown
    extra?: unknown
}

export interface StorageJobData {
    type: 'storage'
    taskId: string
    crawlerTaskId: string
    articles: ArticleData[]
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
