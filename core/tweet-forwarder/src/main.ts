import { X } from '@idol-bbq-utils/spider'
import puppeteer, { CookieParam } from 'puppeteer'

const cookies: CookieParam[] = []

async function main() {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: true })

  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  )
  await page.setCookie(...cookies)
  const tweets = await X.TweetGrabber.article.grabTweets(page, 'https://x.com/cocona_nonaka/')
  console.log(tweets)
  await page.close()
  await browser.close()
}
main()
