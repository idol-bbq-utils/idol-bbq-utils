import { parseNetscapeCookieToPuppeteerCookie, UserAgent } from '../../src'
import { InsApiJsonParser } from '../../src/spiders/instagram'
import puppeteer from 'puppeteer-core'
import fs from 'fs'

test('example test', async () => {
    const browser = await puppeteer.launch({
        headless: true,
        channel: 'chrome',
    })
    const page = await browser.newPage()
    await page.setUserAgent(UserAgent.CHROME)
    await page.setCookie(...parseNetscapeCookieToPuppeteerCookie('tests/data/x/expire.cookies'))
    const res = await InsApiJsonParser.grabPosts(page, 'https://www.instagram.com/instagram/')
    fs.writeFileSync('instagram-posts.json', JSON.stringify(res, null, 2))
    await browser.close()
}, 30000)
