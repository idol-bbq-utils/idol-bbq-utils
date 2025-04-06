enum ArticleTypeEnum {
    /**
     *
     */
    TWEET = 'tweet',
    RETWEET = 'retweet',
    QUOTED = 'quoted',
    CONVERSATION = 'conversation',
}

/**
 * @deprecated
 */
enum TweetTabsEnum {
    TWEETS = 0,
    REPLIES,
    HIGH_LIGHTS,
    MEDIA,
}

/**
 * @deprecated
 */
enum TimelineTypeEnum {
    ARTICLE = 'article',
    DIVIDER = 'divider',
    SHOW_MORE = 'show_more',
    HEADING = 'heading',
    FOLLOW_RECOMMEND = 'follow_recommend',
    DEFAULT = 'default',
}

/**
 * @deprecated
 */
enum ArticleElementTypeEnum {
    TEXT,
    EMOJI,
    HASH_TAG,
    LINK,
}

/**
 * @deprecated
 */
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
    extra?: ITweetExtraWrapper<ITweetCard> | null
}

/**
 * @deprecated
 */
interface ITweetProfile {
    username: string
    u_id: string
    follows: number
    timestamp: number
}

/**
 * desExtra fields for tweet
 */
enum TweetExtraTypeEnum {
    CARD = 'card',
}
interface ITweetCard {
    content: string
    media?: string
    link?: string
}

interface ITweetExtraWrapper<T> {
    type: TweetExtraTypeEnum
    data: T
}

interface ITweetCard {}

export {
    TweetTabsEnum,
    ArticleElementTypeEnum,
    ArticleTypeEnum,
    TimelineTypeEnum,
    TweetExtraTypeEnum,
    ITweetExtraWrapper,
}
export type { ITweetArticle, ITweetProfile, ITweetCard }

/******* graph ql *******/
