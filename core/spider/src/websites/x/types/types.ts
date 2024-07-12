enum TweetTabsEnum {
    TWEETS = 0,
    REPLIES = 1,
    MEDIA = 2,
}

enum ArticleTypeEnum {
    /**
     *
     */
    TWEET = 'tweet',
    FORWARD = 'forward',
    REF = 'ref',
}

enum ArticleElementTypeEnum {
    TEXT,
    EMOJI,
    HASH_TAG,
    LINK,
}

interface ITweetArticle {
    username: string
    u_id: string
    timestamp: number
    text: string
    type: ArticleTypeEnum
    tweet_link?: string | null
    ref?: ITweetArticle | null
    has_media?: boolean | null
    forward_by?: string | null
}

interface ITweetProfile {
    username: string
    u_id: string
    follows: number
    timestamp: number
}

export { TweetTabsEnum, ArticleElementTypeEnum, ArticleTypeEnum }
export type { ITweetArticle, ITweetProfile }
