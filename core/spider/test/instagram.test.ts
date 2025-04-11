import puppeteer from 'puppeteer-core'
import { Spider } from '../src'
import { parseNetscapeCookieToPuppeteerCookie, UserAgent } from '../src/utils'
import { readFileSync } from 'fs'
import { createLogger, winston, format } from '@idol-bbq-utils/log'
import type { GenericFollows } from '../src/types'
import { InsApiJsonParser } from '../src/spiders/instagram'
import { test, expect } from 'bun:test'

/**
 * require network access & headless browser
 */
test.skip('spider', async () => {
    const url = 'https://www.instagram.com/instagram'
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
                transports: [
                    new winston.transports.Console(),
                    new winston.transports.File({
                        filename: `/tmp/logs/tweet-forwarder-${new Date().getTime()}.log`,
                    }),
                ],
            }),
        ).init()
        let id = await spiderInstance._match_valid_url(url, spider)?.groups?.id
        expect(id).toBe('instagram')
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

test('Instagram API JSON Parser', async () => {
    const posts_json = JSON.parse(readFileSync('test/data/instagram/instagram-posts.json', 'utf-8'))
    const hightlights_json = JSON.parse(readFileSync('test/data/instagram/instagram-highlights.json', 'utf-8'))
    const profile_json = JSON.parse(readFileSync('test/data/instagram/instagram-profile.json', 'utf-8'))

    const posts_json_result = JSON.parse(readFileSync('test/data/instagram/instagram-posts-result.json', 'utf-8'))
    const hightlights_json_result = JSON.parse(
        readFileSync('test/data/instagram/instagram-highlights-result.json', 'utf-8'),
    )
    const profile_json_result = JSON.parse(readFileSync('test/data/instagram/instagram-follows-result.json', 'utf-8'))

    expect(InsApiJsonParser.postsParser(posts_json)).toEqual(posts_json_result)
    expect(InsApiJsonParser.highlightsParser(hightlights_json)).toEqual(hightlights_json_result)
    expect(InsApiJsonParser.followsParser(profile_json)).toEqual(profile_json_result)
})
