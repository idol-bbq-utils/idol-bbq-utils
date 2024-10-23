import { Page } from 'puppeteer-core'
import { ITweetArticle, ITweetProfile, TweetTabsEnum } from '../../types/types'
import { tweetArticleParser, tweetReplyParser } from './parser/article'
import { getTimelineType } from './parser/timeline'

/**
 * The URL like https://x.com/username
 */
export async function grabTweets(
    page: Page,
    url: string,
    config: {
        viewport?: {
            width: number
            height: number
        }
    } = {
        viewport: {
            width: 954,
            height: 1024,
        },
    },
): Promise<Array<ITweetArticle>> {
    // Set screen size
    await page.setViewport(config.viewport ?? { width: 954, height: 1024 })
    // Navigate the page to a URL
    await page.goto(url)

    // Click on the tweets tab
    const tablist = await page.$('div[role="tablist"]')
    const tabs = await tablist?.$$('div[role="presentation"]')
    const tab = await tabs?.[TweetTabsEnum.TWEETS].$('a')
    await tab?.click()
    const article_wrapper = await page.waitForSelector('nav[role="navigation"] + section > div')
    // wait for article to load
    await article_wrapper?.waitForSelector('article')
    const raw_articles = await article_wrapper?.$$('article')
    const articles =
        raw_articles && ((await Promise.all(raw_articles?.map(tweetArticleParser))) as Array<ITweetArticle | undefined>)

    return articles?.filter((a) => a !== undefined) || []
}

export async function grabReply(page: Page, url: string): Promise<Array<Array<ITweetArticle>>> {
    await page.setViewport({ width: 873, height: 1500 })
    await page.goto(url)
    // Click on the tweets tab
    const tablist = await page.$('div[role="tablist"]')
    const tabs = await tablist?.$$('div[role="presentation"]')
    const tab = await tabs?.[TweetTabsEnum.REPLIES].$('a')
    await tab?.click()
    const article_wrapper = await page.waitForSelector('nav[role="navigation"] + section > div')
    // wait for article to load
    await article_wrapper?.waitForSelector('article')

    const timeline_items = await article_wrapper?.$$('div[data-testid="cellInnerDiv"]')
    const timeline_types = await Promise.all(timeline_items?.map(getTimelineType) ?? [])
    const res = await tweetReplyParser(timeline_items?.map((e, i) => ({ item: e, type: timeline_types[i] })) ?? [])
    return res
}

export async function grabFollowsNumer(page: Page, url: string): Promise<ITweetProfile> {
    await page.goto(url)
    await page.setViewport({ width: 1080, height: 1024 })
    // Click on the tweets tab
    const profile_area = await page.waitForSelector('script[data-testid="UserProfileSchema-test"]')
    const profile = await profile_area?.evaluate((e) => JSON.parse(e.textContent ?? ''))
    const follows = profile.author.interactionStatistic.filter((e: any) => e.name === 'Follows')[0]
    return {
        username: profile.author.givenName,
        u_id: `@${profile.author.additionalName}`,
        follows: follows.userInteractionCount,
        timestamp: Math.floor(Date.now() / 1000),
    }
}
