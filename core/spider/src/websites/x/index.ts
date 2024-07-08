import { Page } from 'puppeteer'
import { TweetTabs } from './types'

export async function grabTweets(page: Page, url: string) {
  // Navigate the page to a URL
  await page.goto('https://x.com/hanamiya_nina/')

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })
  const tablist = await page.$('div[role="tablist"]')
  const tabs = await tablist?.$$('div[role="presentation"]')
  const tab = await tabs?.[TweetTabs.TWEETS].$('a')
  await tab?.click()
  const profile_content = await page.$('section[aria-labelledby="accessible-list-0"]')
  const html = await profile_content?.evaluate((e) => e.innerHTML)
  console.log(html)
}
