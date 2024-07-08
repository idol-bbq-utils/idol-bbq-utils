import { ElementHandle } from 'puppeteer'
import { ArticleElementTypeEnum, ArticleTypeEnum, ITweetArticle } from '../types/types'

const QUERY_TEXT_PATTERN = 'div[data-testid="tweetText"]'
/**
 * <article>
 *  <div>
 *    <div>
 *      <div>padding</div>
 *      <div>
 *        <div>avatar</div>
 *        <div>
 *          <div>name,id,time</div>
 *          <div>**content**</div>
 *          <div>buttons</div>
 *        </div>
 *      </div>
 *    </div>
 *  </div>
 * </article>
 */
export async function tweetArticleParser(article: ElementHandle<HTMLElement>): Promise<ITweetArticle | undefined> {
  const article_type = await getArticleTypeEnum(article)
  if (article_type === ArticleTypeEnum.FORWARD) {
    // TODO forward parser
    return
  }
  // pure tweet
  if (article_type === ArticleTypeEnum.TWEET) {
    const [info_area, contents] = await Promise.all([
      await article.$('div[data-testid="User-Name"]'),
      await article.$$(QUERY_TEXT_PATTERN),
    ])
    // get time & tweet link
    const info_time = await info_area?.$('a[role="link"]:has(time)')
    const time = await info_time?.$('time')
    const iso_time = await time?.evaluate((e) => e.getAttribute('datetime'))
    const timestamp = new Date(iso_time ?? 0).getTime()
    // get tweet link
    const tweet_link = await info_time?.evaluate((e) => e.getAttribute('href'))
    // get username and id
    const username = await (await info_area?.$(':first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
    const id = await (await info_area?.$('div:first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
    // get article
    const elements = await Promise.all(contents.map(articleElementParser))
    const real_article = elements.join('')
    return {
      username: username || '',
      id: id || '',
      text: real_article,
      tweet_link: tweet_link || '',
      timestamp,
    }
  }
}

async function articleElementParser(element: ElementHandle<Element>) {
  const element_type = await getArticleElementTypeEnum(element)
  switch (element_type) {
    case ArticleElementTypeEnum.TEXT:
      return await element.evaluate((e) => e.textContent)
    case ArticleElementTypeEnum.EMOJI:
      return await element.evaluate((e) => e.getAttribute('alt'))
    case ArticleElementTypeEnum.HASH_TAG:
      const tag_a = await element.$('a')
      return await tag_a?.evaluate((e) => e.textContent)
    case ArticleElementTypeEnum.LINK:
      // TODO
      return ''
  }
}

async function getArticleTypeEnum(article: ElementHandle<Element>): Promise<ArticleTypeEnum> {
  const is_forward_tweet = await article.$('span[data-testid="socialContext"]')
  const is_ref_tweet = await article.$$(QUERY_TEXT_PATTERN)
  if (is_forward_tweet) {
    return ArticleTypeEnum.FORWARD
  }
  if (is_ref_tweet?.length > 1) {
    return ArticleTypeEnum.REF
  }
  // TODO reply
  return ArticleTypeEnum.TWEET
}

async function getArticleElementTypeEnum(element: ElementHandle<Element>): Promise<ArticleElementTypeEnum> {
  const tag_name = await element.evaluate((e) => e.tagName)

  if (tag_name === 'SPAN') {
    const contain_hash_tag = await element.$('a')
    if (contain_hash_tag) {
      return ArticleElementTypeEnum.HASH_TAG
    } else {
      return ArticleElementTypeEnum.TEXT
    }
  }
  if (tag_name === 'IMG') {
    return ArticleElementTypeEnum.EMOJI
  }
  if (tag_name === 'A') {
    return ArticleElementTypeEnum.LINK
  }
  return ArticleElementTypeEnum.TEXT
}
