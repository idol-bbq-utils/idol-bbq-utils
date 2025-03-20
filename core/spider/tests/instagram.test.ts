import puppeteer from 'puppeteer-core'
import { getSpider } from '../src'
import { parseNetscapeCookieToPuppeteerCookie, UserAgent } from '../src/utils'
import { readFileSync, writeFileSync } from 'fs'
import { XApiJsonParser } from '../src/spiders/x/user/graphql'
import { createLogger, winston, format } from '@idol-bbq-utils/log'
import { GenericFollows } from '../src/types'
import { InsApiJsonParser } from '../src/spiders/instagram'

test('Instagram API JSON Parser', async () => {
    const posts_json = JSON.parse(readFileSync('tests/data/instagram/instagram-posts.json', 'utf-8'))
    const hightlights_json = JSON.parse(readFileSync('tests/data/instagram/instagram-highlights.json', 'utf-8'))
    const profile_json = JSON.parse(readFileSync('tests/data/instagram/instagram-profile.json', 'utf-8'))

    const posts_json_result = JSON.parse(readFileSync('tests/data/instagram/instagram-posts-result.json', 'utf-8'))
    const hightlights_json_result = JSON.parse(
        readFileSync('tests/data/instagram/instagram-highlights-result.json', 'utf-8'),
    )
    const profile_json_result = JSON.parse(readFileSync('tests/data/instagram/instagram-follows-result.json', 'utf-8'))

    expect(InsApiJsonParser.postsParser(posts_json)).toEqual(posts_json_result)
    expect(InsApiJsonParser.highlightsParser(hightlights_json)).toEqual(hightlights_json_result)
    expect(InsApiJsonParser.followsParser(profile_json)).toEqual(profile_json_result)
})
