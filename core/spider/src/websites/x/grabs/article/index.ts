import { Page } from 'puppeteer'
import { ITweetArticle, TweetTabsEnum } from '../../types/types'
import { tweetArticleParser } from './parser/article'

/**
 * The URL like https://x.com/username
 */
export async function grabTweets(page: Page, url: string): Promise<Array<ITweetArticle>> {
  // Navigate the page to a URL
  await page.goto(url)

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })
  // Click on the tweets tab
  const tablist = await page.$('div[role="tablist"]')
  const tabs = await tablist?.$$('div[role="presentation"]')
  const tab = await tabs?.[TweetTabsEnum.TWEETS].$('a')
  await tab?.click()
  const article_wrapper = await page.waitForSelector('nav[role="navigation"] + section > div')
  // wait for article to load
  await article_wrapper?.waitForSelector('article')
  const raw_articles = await article_wrapper?.$$('article')
  const articles = await Promise.all(raw_articles?.map(tweetArticleParser) ?? [])

  return articles.filter((a) => a !== undefined)
}
