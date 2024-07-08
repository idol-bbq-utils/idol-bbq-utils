import { ElementHandle, Page } from 'puppeteer'
import { TweetTabs } from './types'

async function tweetArticleParser(tweet: ElementHandle<HTMLElement>) {
  const html = await tweet.evaluate((e) => e.innerHTML)
  return html
}

export async function grabTweets(page: Page, url: string) {
  // Navigate the page to a URL
  await page.goto(url)

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })
  // Click on the tweets tab
  const tablist = await page.$('div[role="tablist"]')
  const tabs = await tablist?.$$('div[role="presentation"]')
  const tab = await tabs?.[TweetTabs.TWEETS].$('a')
  await tab?.click()

  const article_wrapper = await page.waitForSelector('nav[role="navigation"] + section > div')
  // wait for article to load
  await article_wrapper?.waitForSelector('article')
  const raw_articles = await article_wrapper?.$$('article')
  //   const articles = await Promise.all(raw_articles?.map(tweetArticleParser) ?? [])
  const articles = raw_articles && (await tweetArticleParser(raw_articles?.[0]))
  console.log(articles)
}

export async function grabFans(page: Page, url: string) {
  // Navigate the page to a URL
  await page.goto(url)

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })
  const profile_content = await page.$('section[aria-labelledby="accessible-list-0"]')
  const html = await profile_content?.evaluate((e) => e.innerHTML)
  console.log(html)
}
