import type { Article } from '@/db'
import type { ForwardTargetPlatformCommonConfig } from '@/types/forwarder'
import type { MediaType } from '@idol-bbq-utils/spider/types'

/**
 * 中间件处理上下文
 */
export interface ForwarderContext {
    /** 待发送的文本 */
    text: string
    /** 原始文章（可选） */
    article?: Article
    /** 媒体文件列表 */
    media?: Array<{
        media_type: MediaType
        path: string
    }>
    /** 文章时间戳 */
    timestamp?: number
    /** 运行时配置（合并后的） */
    config: ForwardTargetPlatformCommonConfig
    /** 中间件间传递的元数据 */
    metadata: Map<string, any>
    /** 中断原因（如果被中断） */
    abortReason?: string
    /** 是否已中断 */
    aborted: boolean
}

/**
 * 中间件接口
 */
export interface ForwarderMiddleware {
    /** 中间件名称（用于日志和调试） */
    readonly name: string

    /**
     * 处理消息
     * @param context 转发上下文
     * @param next 调用下一个中间件
     * @returns true 继续处理，false 中断流程
     */
    process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean>
}

/**
 * 分块策略接口
 */
export interface ChunkStrategy {
    /**
     * 将文本分块
     * @param text 待分块的文本
     * @param limit 每块的字符限制
     * @returns 分块后的文本数组
     */
    chunk(text: string, limit: number): string[]
}

/**
 * 渲染器接口
 */
export interface MessageRenderer {
    /**
     * 渲染消息
     * @param article 文章对象（可选）
     * @param text 原始文本
     * @returns 渲染后的文本
     */
    render(article: Article | undefined, text: string): string
}
