import { ElementHandle } from 'puppeteer'
import { ArticleTypeEnum, ITweetArticle } from '@/websites/x/types/types'
import { articleElementParser } from './element'

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
    const [meta, contents] = await Promise.all([
      await tweetMetaParser(article),
      await article.$$(`${QUERY_TEXT_PATTERN} > *`),
    ])

    // get article
    const elements = await Promise.all(contents.map(articleElementParser))
    const real_article = elements.join('')
    return {
      username: meta.username,
      id: meta.id,
      text: real_article,
      tweet_link: meta.tweet_link,
      timestamp: meta.timestamp,
    }
  }
}

async function tweetMetaParser(
  article: ElementHandle<HTMLElement>,
): Promise<Pick<ITweetArticle, 'username' | 'id' | 'tweet_link' | 'timestamp'>> {
  const info_area = await article.$('div[data-testid="User-Name"]')
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
  return {
    username: username || '',
    id: id || '',
    tweet_link: tweet_link || '',
    timestamp,
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
