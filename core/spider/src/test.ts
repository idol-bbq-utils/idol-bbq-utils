import puppeteer from 'puppeteer'
import { X } from './websites'

async function main() {
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    )
    const res = await X.TweetGrabber.UserPage.grabFollowsNumer(page, 'https://x.com/hanamiya_nina')

    console.log(res)
    await browser.close()
}

main()
