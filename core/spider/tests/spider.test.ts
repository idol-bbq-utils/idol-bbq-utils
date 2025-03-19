import puppeteer from 'puppeteer-core'
import { getSpider } from '../src'
import { parseNetscapeCookieToPuppeteerCookie, UserAgent } from '../src/utils'

test('X Spider', async () => {
    const url = 'https://x.com/hanamiya_nina'
    const spider = getSpider(url)
    if (spider) {
        let id = await new spider()._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('hanamiya_nina')
    }
})

test('X Spider grab tweets', async () => {
    const url = 'https://x.com/elonmusk'
    const spider = getSpider(url)
    if (spider) {
        const spiderInstance = new spider()
        let id = await spiderInstance._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('elonmusk')
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: 'chrome',
        })
        const page = await browser.newPage()
        await page.setUserAgent(UserAgent.CHROME)
        let res = []
        try {
            res = await spiderInstance.crawl(url, page, 'article')
        } catch (e) {
            console.error(e)
        } finally {
            await browser.close()
        }
        expect(res.length).toBeGreaterThan(0)
    }
})
