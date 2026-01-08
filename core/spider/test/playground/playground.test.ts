import { createLogger, format, winston } from '@idol-bbq-utils/log'
import { parseNetscapeCookieToPuppeteerCookie, Spider, UserAgent } from '@/.'
import type { GenericFollows } from '@/types'
import puppeteer from 'puppeteer-core'
import { test, expect, describe } from 'bun:test'
import { readFileSync, writeFileSync } from 'fs'

describe('playground', () => {
    const log = createLogger({
        defaultMeta: { service: 'tweet-forwarder' },
        level: 'debug',
        format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
            format.printf(({ message, timestamp, level, label, service, subservice }) => {
                const metas = [service, subservice, label, level]
                    .filter(Boolean)
                    .map((meta) => `[${meta}]`)
                    .join(' ')
                return `${timestamp} ${metas}: ${message}`
            }),
        ),
        transports: [new winston.transports.Console()],
    })
    test('grap api info', async() => {
        // let html = readFileSync('x.html', 'utf-8');
        // const lists_graphql_js_pattern = /"([^"]*AudioSpacebarScr)"\s*:\s*"(\w+)"/
        // const match = html.match(lists_graphql_js_pattern)
        // function getQueryId(js: string, targetOperationName: string) {
        //     const escapedOperationName = targetOperationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        //     const regex = new RegExp(`queryId:"([^"]+)",operationName:"${escapedOperationName}"`, 's')
        //     const match = js.match(regex)
        //     return match ? match[1] : null
        // }
        // if (match) {
        //     const js_url =  `${"https://abs.twimg.com/responsive-web/client-web"}/${match[1]}.${match[2]}a.js`
        //     console.log(js_url)
        //     const js_code = await (await fetch(js_url)).text()
        //     const queryId = getQueryId(js_code, "ListLatestTweetsTimeline")
        //     console.log(queryId)
        // }
        return
    }),
    test('grab articles', async () => {
        const url = 'https://x.com/i/lists/1966417359020912858'
        const spider = Spider.getSpider(url)
        if (spider) {
            const spiderInstance = new spider(log).init()
            const browser = await puppeteer.launch({
                headless: true,
                channel: 'chrome',
            })
            const page = await browser.newPage()
            await page.setUserAgent(UserAgent.CHROME)
            await page.browserContext().setCookie(...parseNetscapeCookieToPuppeteerCookie('cookie.txt'))
                        try {
                console.time('test')
                const articles = await spiderInstance.crawl(url, page, '', {
                    // task_type: 'follows',
                    // sub_task_type: ['replies'],
                    crawl_engine: 'api-graphql',
                })
                // writeFileSync('1.json', JSON.stringify(articles))
                console.timeEnd('test')
                expect(articles.length).toBeGreaterThan(0)
            } catch (e) {
                console.error(e)
            } finally {
                await page.close()
                await browser.close()
            }
        }
    }),
    test('grab follows', async () => {
        const url = 'https://x.com/i/lists/1966417359020912858'
        const spider = Spider.getSpider(url)
        if (spider) {
            const spiderInstance = new spider(log).init()
            const browser = await puppeteer.launch({
                headless: true,
                channel: 'chrome',
            })
            const page = await browser.newPage()
            await page.setUserAgent(UserAgent.CHROME)
            await page.browserContext().setCookie(...parseNetscapeCookieToPuppeteerCookie('cookie.txt'))
            try {
                console.time('test')
                const follows = await spiderInstance.crawl(url, page, '', {
                    task_type: 'follows',
                    // sub_task_type: ['replies'],
                    crawl_engine: 'api-graphql',
                })
                // writeFileSync('1.json', JSON.stringify(follows))
                console.timeEnd('test')
                expect(follows.length).toBeGreaterThan(0)
            } catch (e) {
                console.error(e)
            } finally {
                await page.close()
                await browser.close()
            }
        }
    }, 300000)
})
