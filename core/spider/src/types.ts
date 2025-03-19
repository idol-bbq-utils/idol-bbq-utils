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
    ? GenericArticle<P>
    : T extends 'follows'
      ? string
      : never
interface GenericArticle<T extends Platform> {
    platform: T
    /**
     * article id from the platform
     */
    a_id: string
    user_id: string
    user_name: string
    published_at: number
    content: string
    url: string
    type: ArticleType<T>
    /**
     * reference to the original article: `a_id`
     */
    ref: string
    has_media: boolean
    /**
     * extra data for the article related to the platform
     */
    extra: ArticleExtractType<T>
}

export { TaskType, Platform }
export type { GenericArticle, TaskTypeResult }
