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
    REPLY = 'reply',
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

export { TweetTabsEnum, ArticleElementTypeEnum, ArticleTypeEnum }
export type { ITweetArticle }
