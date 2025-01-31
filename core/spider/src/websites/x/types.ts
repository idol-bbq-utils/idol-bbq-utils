enum TweetTabsEnum {
    TWEETS = 0,
    REPLIES,
    HIGH_LIGHTS,
    MEDIA,
}

enum ArticleTypeEnum {
    /**
     *
     */
    TWEET = 'tweet',
    FORWARD = 'forward',
    REF = 'ref',
    REPLY = 'reply',
}

enum TimelineTypeEnum {
    ARTICLE = 'article',
    DIVIDER = 'divider',
    SHOW_MORE = 'show_more',
    HEADING = 'heading',
    FOLLOW_RECOMMEND = 'follow_recommend',
    DEFAULT = 'default',
}

enum ArticleElementTypeEnum {
    TEXT,
    EMOJI,
    HASH_TAG,
    LINK,
}

enum TweetCardTypeEnum {
    LAYOUT_SMALL,
    LAYOUT_LARGE,
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

interface ITweetCard {}

export { TweetTabsEnum, ArticleElementTypeEnum, ArticleTypeEnum, TimelineTypeEnum }
export type { ITweetArticle, ITweetProfile }
