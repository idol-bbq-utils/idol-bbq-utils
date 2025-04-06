import { createLogger, format, winston } from '../../../log/src'
import { getSpider, parseNetscapeCookieToPuppeteerCookie, UserAgent } from '../../src'
import { GenericFollows } from '../../src/types'
import puppeteer from 'puppeteer-core'

test('example test', async () => {
    const url = 'https://x.com/X'
    const spider = getSpider(url)
    if (spider) {
        const spiderInstance = new spider(
            createLogger({
                defaultMeta: { service: 'tweet-forwarder' },
                level: 'debug',
                format: format.combine(
                    format.colorize(),
                    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
                    format.printf(({ message, timestamp, level, label, service, childService }) => {
                        const metas = [service, childService, label, level]
                            .filter(Boolean)
                            .map((meta) => `[${meta}]`)
                            .join(' ')
                        return `${timestamp} ${metas}: ${message}`
                    }),
                ),
                transports: [
                    new winston.transports.Console(),
                    new winston.transports.File({
                        filename: `/tmp/logs/tweet-forwarder-${new Date().getTime()}.log`,
                    }),
                ],
            }),
        ).init()
        const browser = await puppeteer.launch({
            headless: true,
            channel: 'chrome',
        })
        const page = await browser.newPage()
        const page2 = await browser.newPage()
        const page3 = await browser.newPage()
        await page.setUserAgent(UserAgent.CHROME)
        await page2.setUserAgent(UserAgent.CHROME)
        await page3.setUserAgent(UserAgent.CHROME)
        await page.setCookie(...parseNetscapeCookieToPuppeteerCookie('tests/data/expire.cookies'))
        await page2.setCookie(...parseNetscapeCookieToPuppeteerCookie('tests/data/expire.cookies'))
        await page3.setCookie(...parseNetscapeCookieToPuppeteerCookie('tests/data/expire.cookies'))
        let res = []
        let follows = {} as GenericFollows
        try {
            console.time('test')
            // const [res] = await Promise.all([spiderInstance.crawl(url, page, 'article')])
            // const [follows] = await Promise.all([spiderInstance.crawl(url, page2, 'follows')])
            const [res, follows, res2] = await Promise.all([
                spiderInstance.crawl(url, page, 'article'),
                spiderInstance.crawl(url, page2, 'follows'),
                spiderInstance.crawl('https://x.com/elonmusk', page3, 'article'),
            ])
            console.timeEnd('test')
            expect(res.length).toBeGreaterThan(0)
            expect(follows.followers).toBeGreaterThan(0)
        } catch (e) {
            console.error(e)
        } finally {
            await page.close()
            await browser.close()
        }
    }
}, 30000)
