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
  id: string
  timestamp: number
  text: string
  tweet_link: string
  type: Omit<ArticleTypeEnum, 'tweet_link'>
  ref?: ITweetArticle
  has_media?: boolean
}

export { TweetTabsEnum, ArticleElementTypeEnum, ArticleTypeEnum }
export type { ITweetArticle }
