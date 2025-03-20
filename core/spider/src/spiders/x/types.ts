/**
 * @deprecated
 */
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
    RETWEET = 'retweet',
    QUOTED = 'quoted',
    CONVERSATION = 'conversation',
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

interface ITweetProfile {
    username: string
    u_id: string
    follows: number
    timestamp: number
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
