import { createLogger, format, winston } from '@idol-bbq-utils/log'
import { Spider, UserAgent } from '@/.'
import type { GenericFollows } from '@/types'
import puppeteer from 'puppeteer-core'
import { test, expect, describe } from 'bun:test'

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
    test('grab follows', async () => {
        const url = 'https://x.com/X'
        const spider = Spider.getSpider(url)
        if (spider) {
            const spiderInstance = new spider(log).init()
            const browser = await puppeteer.launch({
                headless: true,
                channel: 'chrome',
            })
            const page = await browser.newPage()
            await page.setUserAgent(UserAgent.CHROME)
            let follows = {} as GenericFollows
            try {
                console.time('test')
                follows = await spiderInstance.crawl(url, page, 'follows')
                console.log(follows)
                console.timeEnd('test')
                expect(follows.followers).toBeGreaterThan(0)
            } catch (e) {
                console.error(e)
            } finally {
                await page.close()
                await browser.close()
            }
        }
    })
})
