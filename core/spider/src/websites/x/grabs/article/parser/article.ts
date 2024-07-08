import { ElementHandle } from 'puppeteer'
import { ArticleTypeEnum, ITweetArticle } from '@/websites/x/types/types'
import { articleElementParser } from './element'
import { log } from '@/config'

const QUERY_TEXT_PATTERN = 'div[data-testid="tweetText"]'
const QUERY_META_PATTERN = 'div[data-testid="User-Name"]'
const QUERY_IMG_PATTERN = 'div[data-testid="tweetPhoto"]'
const QUERY_VIDEO_PATTERN = 'div[data-testid="previewInterstitial"]'

export async function tweetArticleParser(article: ElementHandle<HTMLElement>): Promise<ITweetArticle | undefined> {
  const article_type = await getArticleTypeEnum(article)
  if ([ArticleTypeEnum.FORWARD, ArticleTypeEnum.TWEET].includes(article_type)) {
    const [raw_meta, texts, img, video] = await Promise.all([
      await article.$(QUERY_META_PATTERN),
      await article.$$(`${QUERY_TEXT_PATTERN} > *`),
      await article.$(QUERY_IMG_PATTERN),
      await article.$(QUERY_VIDEO_PATTERN),
    ])
    const meta = await tweetMetaParser(raw_meta)
    const elements = await Promise.all(texts.map(articleElementParser))
    return {
      username: meta.username,
      id: meta.id,
      text: elements.join(''),
      tweet_link: meta.tweet_link,
      timestamp: meta.timestamp,
      type: article_type,
      has_media: !!img || !!video,
    }
  }

  // ref tweet
  if (article_type === ArticleTypeEnum.REF) {
    const [metas, texts] = await Promise.all([
      await article.$$(QUERY_META_PATTERN),
      await article.$$(QUERY_TEXT_PATTERN),
    ])
    const [origin_meta, ref_meta] = await Promise.all([
      await tweetMetaParser(metas?.[0]),
      await tweetMetaParser(metas?.[1]),
    ])
    const [origin_contents, ref_contents] = await Promise.all([
      await texts?.[0].$$(`:scope > *`),
      await texts?.[1].$$(`:scope > *`),
    ])
    const [origin_elements, ref_elements] = await Promise.all([
      await Promise.all(origin_contents.map(articleElementParser)),
      await Promise.all(ref_contents.map(articleElementParser)),
    ])

    const next = await article?.$('div[aria-labelledby] > div')
    const next_has_meta = await next?.$(QUERY_META_PATTERN)
    const next_has_media = (
      await Promise.all([await next?.$(QUERY_IMG_PATTERN), await next?.$(QUERY_VIDEO_PATTERN)])
    ).some((e) => !!e)
    return {
      ...origin_meta,
      text: origin_elements.join(''),
      type: article_type,
      // this is a little tricky, if next has meta, then it is a ref tweet, otherwise it is photo , video or something
      has_media: !!next_has_media && !next_has_meta,
      ref: {
        ...ref_meta,
        text: ref_elements.join(''),
        type: ArticleTypeEnum.TWEET,
      },
    }
  }
}

async function tweetMetaParser(
  info_area: ElementHandle<HTMLElement> | null,
): Promise<Pick<ITweetArticle, 'username' | 'id' | 'tweet_link' | 'timestamp'>> {
  if (!info_area) {
    return {
      username: '',
      id: '',
      tweet_link: '',
      timestamp: 0,
    }
  }
  // get time & tweet link
  const info_link = await info_area?.$('a[role="link"]:has(time)')
  const tweet_link = await info_link?.evaluate((e) => e.getAttribute('href'))
  // get tweet time
  const time = await info_area?.$('time')
  const iso_time = await time?.evaluate((e) => e.getAttribute('datetime'))
  const timestamp = new Date(iso_time ?? 0).getTime()

  // get username and id
  const username = await (await info_area?.$(':first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
  const id = await (await info_area?.$('div:first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
  return {
    username: username || '',
    id: id || '',
    tweet_link: tweet_link || '',
    timestamp,
  }
}

async function getArticleTypeEnum(article: ElementHandle<Element>): Promise<ArticleTypeEnum> {
  const is_forward_tweet = await article.$('span[data-testid="socialContext"]')
  if (is_forward_tweet) {
    return ArticleTypeEnum.FORWARD
  }

  const is_ref_tweet = await article.$$(QUERY_TEXT_PATTERN)
  if (is_ref_tweet?.length > 1) {
    return ArticleTypeEnum.REF
  }
  // TODO reply
  return ArticleTypeEnum.TWEET
}
