enum TweetTabsEnum {
  TWEETS = 0,
  REPLIES = 1,
  MEDIA = 2,
}

enum ArticleTypeEnum {
  /**
   *
   */
  TWEET,
  FORWARD,
  REPLY,
  REF,
}

enum ArticleElementTypeEnum {
  TEXT,
  EMOJI,
  HASH_TAG,
  LINK,
}

interface ITweetArticle {
  username: string
  id: string
  timestamp: number
  text: string
  tweet_link: string
  pics?: string[]
  ref?: ITweetArticle
}

export { TweetTabsEnum, ArticleElementTypeEnum, ArticleTypeEnum }
export type { ITweetArticle }
