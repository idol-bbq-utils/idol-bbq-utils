import { Page } from 'puppeteer'

export async function grabTweets(page: Page, url: string) {
  // Navigate the page to a URL
  await page.goto(url)

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })
  const tablist = await page.$('div[role="tablist"]')
  const tabs = await tablist?.$$('div[role="presentation]')
  tabs?.forEach(async (tab) => {
    const content = await tab.evaluate((e) => e.innerHTML)
    console.log(content)
  })
}
