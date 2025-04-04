import { GenericArticle, GenericFollows, Platform, TaskType, TaskTypeResult } from '@/types'
import { BaseSpider } from './base'
import { Page } from 'puppeteer-core'
import { JSONPath } from 'jsonpath-plus'
import { waitForResponse } from '@/spiders/base'

enum ArticleTypeEnum {
    /**
     *
     */
    TWEET = 'tweet',
    RETWEET = 'retweet',
    QUOTED = 'quoted',
    CONVERSATION = 'conversation',
}

const X_BASE_VALID_URL = /(https:\/\/)?(www\.)?x\.com\//
class XTimeLineSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = new RegExp(X_BASE_VALID_URL.source + /(?<id>\w+)/.source)
    static _PLATFORM = Platform.X
    BASE_URL: string = 'https://x.com/'
    NAME: string = 'X TimeLine Spider'

    async _crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type: T = 'article' as T,
    ): Promise<TaskTypeResult<T, Platform.X>> {
        const result = super._match_valid_url(url, XTimeLineSpider)?.groups
        if (!result) {
            throw new Error(`Invalid URL: ${url}`)
        }
        const { id } = result
        const _url = `${this.BASE_URL}${id}`

        if (task_type === 'article') {
            let res = []
            this.log?.info(`Trying to grab tweets for ${id}.`)
            res = await XApiJsonParser.grabTweets(page, _url)
            this.log?.info(`Trying to grab replies for ${id}.`)
            const replies = await XApiJsonParser.grabReplies(page, _url + '/with_replies')
            return res.concat(replies) as TaskTypeResult<T, Platform.X>
        }

        if (task_type === 'follows') {
            this.log?.info(`Trying to grab follows for ${id}.`)
            return (await XApiJsonParser.grabFollowsNumer(page, _url)) as TaskTypeResult<T, Platform.X>
        }

        throw new Error('Invalid task type')
    }
}
namespace XApiJsonParser {
    function sanitizeTweetsJson(json: any) {
        let tweets = JSONPath({ path: "$..instructions[?(@.type === 'TimelineAddEntries')].entries", json })[0]
        let pin_tweet = JSONPath({ path: "$..instructions[?(@.type === 'TimelinePinEntry')].entry", json })[0]
        if (!tweets) {
            throw new Error('Tweet json format may have changed')
        }

        if (pin_tweet) {
            tweets.unshift(pin_tweet)
        }
        return tweets
    }

    // 时间转换辅助函数
    function parseTwitterDate(dateStr: string) {
        return Date.parse(dateStr.replace(/( \+0000)/, ' UTC$1'))
    }

    // TODO
    function cardParser(card: any) {
        if (!card) {
            return null
        }
        if (card.name.includes('image')) {
            return {
                type: 'card',
                data: {
                    content: card.binding_values?.find(({ key }: { key: string }) => key === 'title')?.value
                        ?.string_value,
                    media: card.binding_values?.find(
                        ({ key }: { key: string }) => key === 'photo_image_full_size_original',
                    )?.value?.image_value?.url,
                    link: card.binding_values?.find(({ key }: { key: string }) => key === 'card_url')?.value
                        ?.string_value,
                },
            }
        }
        return null
    }

    function mediaParser(media: any) {
        if (!media) {
            return null
        }
        return media
            .map((m: any) => {
                const { media_url_https, video_info, type, ext_alt_text } = m
                if (type === 'photo') {
                    return {
                        type,
                        url: media_url_https,
                        alt: ext_alt_text,
                    }
                }
                if (type === 'video' || type === 'animated_gif') {
                    return {
                        type: 'video',
                        url: video_info?.variants
                            ?.filter((i: { bitrate?: number }) => i.bitrate !== undefined)
                            .sort((a: { bitrate: number }, b: { bitrate: number }) => b.bitrate - a.bitrate)[0].url,
                    }
                }
            })
            .filter(Boolean)
    }

    function tweetParser(result: any): GenericArticle<Platform> {
        // TweetWithVisibilityResults --> result.tweet
        const legacy = result.legacy || result.tweet?.legacy
        const userLegacy = (result.core || result.tweet?.core)?.user_results?.result?.legacy
        let content = legacy?.full_text
        for (const { url } of legacy?.entities?.media || []) {
            content = content.replace(url, '')
        }

        // 主推文解析
        const tweet = {
            platform: Platform.X,
            a_id: legacy?.id_str,
            u_id: userLegacy?.screen_name,
            username: userLegacy?.name,
            created_at: Math.floor(parseTwitterDate(legacy?.created_at) / 1000),
            content: legacy?.full_text,
            url: userLegacy?.screen_name ? `https://x.com/${userLegacy.screen_name}/status/${legacy?.id_str}` : '',
            type: result.quoted_status_result?.result ? ArticleTypeEnum.QUOTED : ArticleTypeEnum.TWEET,
            ref: result.quoted_status_result?.result
                ? tweetParser(result.quoted_status_result.result)
                : result.retweeted_status_result?.result
                  ? tweetParser(result.retweeted_status_result.result)
                  : null,
            media: mediaParser(legacy?.entities?.media || legacy?.extended_entities?.media),
            has_media: !!legacy?.entities?.media || !!legacy?.extended_entities?.media,
            extra: cardParser(result.card?.legacy),
            u_avatar: userLegacy?.profile_image_url_https?.replace('_normal', ''),
        }

        // 处理转发类型
        if (legacy?.retweeted_status_result) {
            tweet.type = ArticleTypeEnum.RETWEET
            tweet.content = ''
            tweet.ref = tweetParser(legacy.retweeted_status_result.result)
            // 转发类型推文media按照ref为准
            tweet.media = null
        }

        if (tweet.media) {
            for (const { url } of legacy.entities.media) {
                tweet.content = tweet.content.replace(url, '')
            }
        }
        return tweet
    }

    export function tweetsArticleParser(json: any) {
        let tweets = sanitizeTweetsJson(json)
        tweets = tweets
            .filter((t: { entryId: string }) => t.entryId.startsWith('tweet-'))
            .map((t: { content: any }) => t.content?.itemContent?.tweet_results?.result)
            .filter(Boolean)
        return tweets.map(tweetParser)
    }

    export function tweetsRepliesParser(json: any) {
        const tweets = sanitizeTweetsJson(json)
        const conversations = tweets
            .filter((t: { entryId: string }) => t.entryId.startsWith('profile-conversation'))
            .map((t: { content: { items: any } }) => t.content.items)
            .map((t: any[]) =>
                t
                    .map(
                        (i) =>
                            i.item?.itemContent?.tweet_results?.result?.tweet ||
                            i.item?.itemContent?.tweet_results?.result,
                    )
                    .filter(Boolean),
            )
        return conversations
            .map((c: any[]) => c.map(tweetParser))
            .map((c: any[]) =>
                c.reduce((acc, t) => {
                    if (acc) {
                        t.ref = acc
                        t.type = ArticleTypeEnum.CONVERSATION
                    }
                    // 去除回复中的@用户名
                    if (/^@\w+ /.test(t.content)) {
                        t.content = t.content.replace(/^@\w+ /, '')
                    }
                    return t
                }, null),
            )
    }

    export function tweetsFollowsParser(json: any): GenericFollows {
        const user = JSONPath({ path: '$..user.result.legacy', json })[0]
        if (!user) {
            throw new Error('Follows json format may have changed')
        }
        return {
            platform: Platform.X,
            username: user?.name,
            u_id: user?.screen_name,
            followers: user?.followers_count,
        }
    }

    /**
     * @param url https://x.com/username
     * @description grab tweets from user page
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
                height: 2,
            },
        },
    ): Promise<Array<GenericArticle<Platform.X>>> {
        let tweets_json
        const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
            const url = response.url()
            if (url.includes('UserTweets') && response.request().method() === 'GET') {
                if (response.status() >= 400) {
                    fail(new Error(`Error: ${response.status()}`))
                    return
                }
                response
                    .json()
                    .then((json) => {
                        tweets_json = json
                        done()
                    })
                    .catch((error) => {
                        fail(error)
                    })
            }
        })
        try {
            await page.setViewport(config.viewport ?? { width: 954, height: 2 })
            await page.goto(url)
            await checkLogin(page)
            await checkSomethingWrong(page)
        } catch (error) {
            cleanup()
            throw error
        }
        const { success, error } = await waitForTweets
        if (!success) {
            throw error
        }

        return XApiJsonParser.tweetsArticleParser(tweets_json)
    }

    /**
     * @param url https://x.com/username/replies
     * @description grab replies from user page
     */
    export async function grabReplies(
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
                height: 2,
            },
        },
    ): Promise<Array<GenericArticle<Platform.X>>> {
        let tweets_json
        const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
            const url = response.url()
            if (url.includes('UserTweetsAndReplies') && response.request().method() === 'GET') {
                if (response.status() >= 400) {
                    fail(new Error(`Error: ${response.status()}`))
                    return
                }
                response
                    .json()
                    .then((json) => {
                        tweets_json = json
                        done()
                    })
                    .catch((error) => {
                        fail(error)
                    })
            }
        })
        await page.setViewport(config.viewport ?? { width: 954, height: 2 })
        await page.goto(url)
        try {
            await checkLogin(page)
            await checkSomethingWrong(page)
        } catch (error) {
            cleanup()
            throw error
        }
        const { success, error } = await waitForTweets
        if (!success) {
            throw error
        }
        return XApiJsonParser.tweetsRepliesParser(tweets_json)
    }

    /**
     * @param url https://x.com/username
     */
    export async function grabFollowsNumer(page: Page, url: string): Promise<GenericFollows> {
        let user_json
        const { promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
            const url = response.url()
            if (url.includes('UserByScreenName') && response.request().method() === 'GET') {
                if (response.status() >= 400) {
                    fail(new Error(`Error: ${response.status()}`))
                    return
                }
                response
                    .json()
                    .then((json) => {
                        user_json = json
                        done()
                    })
                    .catch((error) => {
                        fail(error)
                    })
            }
        })
        await page.setViewport({ width: 1080, height: 2 })
        await page.goto(url)

        const { success, error } = await waitForTweets
        if (!success) {
            throw error
        }
        return XApiJsonParser.tweetsFollowsParser(user_json)
    }

    /**
     * Check if there is something wrong on the page of https://x.com/username
     */
    export async function checkSomethingWrong(page: Page) {
        const retry_button = await page
            .waitForSelector('nav[role="navigation"] + div > button', { timeout: 1000 })
            .catch(() => null)
        if (retry_button) {
            const error = await page.$('nav[role="navigation"] + div > div:first-child')
            throw new Error(
                `Something wrong on the page, maybe you have reached the limit or cookies are expired: ${await error?.evaluate((e) => e.textContent)}`,
            )
        }
    }

    export async function checkLogin(page: Page) {
        const login_button = await page
            .waitForSelector('a[href="/login"], [href*="/i/flow/login"]', { timeout: 1000 })
            .catch(() => null)
        if (login_button) {
            throw new Error('You need to login first, check your cookies')
        }
    }
}

export { ArticleTypeEnum, XApiJsonParser, XTimeLineSpider }
