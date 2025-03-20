import * as X from './spiders/x/types'

enum Platform {
    X = 1,
    Twitter = 1,
    // Instagram,
    // TikTok,
}

type PlatformArticleMap = {
    [Platform.X]: X.ArticleTypeEnum
    [Platform.Twitter]: X.ArticleTypeEnum
}

type PlatformExtractMap = {
    [Platform.X]: any
    [Platform.Twitter]: any
}

// related to platform
type ArticleType<T extends Platform> = PlatformArticleMap[T]
type ArticleExtractType<T extends Platform> = PlatformExtractMap[T]

type TaskType = 'article' | 'follows'

type TaskTypeResult<T extends TaskType, P extends Platform> = T extends 'article'
    ? Array<GenericArticle<P>>
    : T extends 'follows'
      ? GenericFollows
      : never

type MeidaType = 'photo' | 'video'
interface GenericMediaInfo {
    type: MeidaType
    /**
     * best quality url
     */
    url: string
    alt?: string
}

interface GenericFollows {
    plattform: Platform
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
    created_at: number
    content: string
    url: string
    type: ArticleType<T>
    /**
     * reference to the original article: `a_id`
     */
    ref: GenericArticle<T> | null
    media: Array<GenericMediaInfo> | null
    /**
     * extra data for the article related to the platform
     */
    extra: ArticleExtractType<T> | null
}

export { Platform }
export type { GenericArticle, GenericFollows, TaskTypeResult, TaskType, MeidaType }
