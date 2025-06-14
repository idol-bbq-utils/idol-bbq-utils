import { X, Instagram, Tiktok, Youtube } from './spiders'
import type { ExtraContentType } from './spiders/x'

type CrawlEngine = 'browser' | 'api'

enum Platform {
    X = 1,
    Twitter = 1,
    Instagram,
    TikTok,
    YouTube,
}

type PlatformArticleMap = {
    [Platform.X]: X.ArticleTypeEnum
    [Platform.Twitter]: X.ArticleTypeEnum
    [Platform.Instagram]: Instagram.ArticleTypeEnum
    [Platform.TikTok]: Tiktok.ArticleTypeEnum
    [Platform.YouTube]: Youtube.ArticleTypeEnum
}

type PlatformExtractMap = {
    [Platform.X]: ExtraContentType
    [Platform.Twitter]: ExtraContentType
    [Platform.Instagram]: null
    [Platform.TikTok]: null
    [Platform.YouTube]: null
}

type PlatformRefMap = {
    [Platform.X]: string,
    [Platform.Twitter]: string,
    [Platform.Instagram]: null,
    [Platform.TikTok]: null,
    [Platform.YouTube]: null,
}

// related to platform
type ArticleType<T extends Platform> = PlatformArticleMap[T]
type ArticleExtractType<T extends Platform> = {
    data: PlatformExtractMap[T]
    /**
     * content that will be sent as text
     */
    content?: string
    media?: Array<GenericMediaInfo>
    extra_type?: string
}

type TaskType = 'article' | 'follows'

type TaskTypeResult<T extends TaskType, P extends Platform> = T extends 'article'
    ? Array<GenericArticle<P>>
    : T extends 'follows'
      ? Array<GenericFollows>
      : never

type MediaType = 'photo' | 'video' | 'video_thumbnail' | 'unknown'
interface GenericMediaInfo {
    type: MediaType
    /**
     * best quality url
     */
    url: string
    alt?: string
}

interface GenericFollows {
    platform: Platform
    username: string
    u_id: string
    followers: number
}
interface GenericArticle<T extends Platform> {
    platform: T
    /**
     * article id from the platform
     */
    a_id: string
    u_id: string
    username: string
    /**
     * timestamp in seconds
     */
    created_at: number
    content: string | null
    url: string
    type: ArticleType<T>
    /**
     * reference to the original article: `a_id`
     */
    ref: GenericArticleRef<T> | null
    has_media: boolean
    /**
     * media for not using gallery-dl
     * if has_media is true and this is null, then use gallery-dl
     */
    media: Array<GenericMediaInfo> | null
    /**
     * extra data for the article related to the platform
     */
    extra: ArticleExtractType<T> | null
    /**
     * (optional) user avatar
     */
    u_avatar: string | null
}

type GenericArticleRef<T extends Platform> = GenericArticle<T> | string

export { Platform }
export type {
    GenericArticle,
    GenericMediaInfo,
    GenericFollows,
    TaskTypeResult,
    TaskType,
    MediaType,
    ArticleExtractType,
    CrawlEngine,
    GenericArticleRef,
}
