import puppeteer from 'puppeteer-core'
import { Spider, X } from '@/.'
import { parseNetscapeCookieToPuppeteerCookie, UserAgent } from '@/utils'
import { readFileSync } from 'fs'
import { createLogger, winston, format } from '@idol-bbq-utils/log'
import { test, expect } from 'bun:test'
import type { GenericFollows } from '@/types'

test('X Spider', async () => {
    const url = 'https://x.com/X'
    const spider = Spider.getSpider(url)
    if (spider) {
        let id = await new spider()._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('X')
    }
})

/**
 * require network access & headless browser
 */
test.skip('spider', async () => {
    const url = 'https://x.com/X'
    const spider = Spider.getSpider(url)
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
            }),
        ).init()
        let id = await spiderInstance._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('X')
        const browser = await puppeteer.launch({
            headless: true,
            channel: 'chrome',
        })
        const page = await browser.newPage()
        await page.setUserAgent(UserAgent.CHROME)
        await page.setCookie(...parseNetscapeCookieToPuppeteerCookie('tests/data/expire.cookies'))
        let res = []
        let follows = {} as GenericFollows
        try {
            res = await spiderInstance.crawl(url, page, 'article')
            follows = (await spiderInstance.crawl(url, page, 'follows')) as unknown as GenericFollows
        } catch (e) {
            console.error(e)
        } finally {
            await browser.close()
        }
        expect(res.length).toBeGreaterThan(0)
        expect(follows.followers).toBeGreaterThan(0)
    }
})

test('X API JSON Parser', async () => {
    const x_json = JSON.parse(readFileSync('test/data/x/x.json', 'utf-8'))
    const x_result = JSON.parse(readFileSync('test/data/x/x-result.json', 'utf-8'))
    const x_replies_result = JSON.parse(readFileSync('test/data/x/x-replies-result.json', 'utf-8'))
    const x_follows = JSON.parse(readFileSync('test/data/x/x-follows.json', 'utf-8'))
    const x_follows_result = JSON.parse(readFileSync('test/data/x/x-follows-result.json', 'utf-8'))
    const x_response = X.XApiJsonParser.tweetsArticleParser(x_json)
    const x_replies_response = X.XApiJsonParser.tweetsRepliesParser(x_json)
    const x_follows_response = X.XApiJsonParser.tweetsFollowsParser(x_follows)
    expect(x_response).toEqual(x_result)
    expect(x_replies_response).toEqual(x_replies_result)
    expect(x_follows_response).toEqual(x_follows_result)
})
