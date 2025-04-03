import { Page, PageEvent } from 'puppeteer-core'
import { ArticleTypeEnum } from '../types'
import { checkLogin, checkSomethingWrong } from '.'
import { GenericArticle, GenericFollows, Platform } from '@/types'
import { JSONPath } from 'jsonpath-plus'
import { waitForEvent, waitForResponse } from '@/spiders/base'
export namespace XApiJsonParser {
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
        return media.map((m: any) => {
            const { media_url_https, video_info, type, ext_alt_text } = m
            if (type === 'photo') {
                return {
                    type,
                    url: media_url_https,
                    alt: ext_alt_text,
                }
            }
            if (type === 'video') {
                return {
                    type,
                    url: video_info?.variants
                        ?.filter((i: { bitrate?: number }) => i.bitrate !== undefined)
                        .sort((a: { bitrate: number }, b: { bitrate: number }) => b.bitrate - a.bitrate)[0].url,
                }
            }
        })
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
        const { cleanup, promise: waitForTweets } = waitForEvent(
            page,
            PageEvent.Response,
            async (response, { resolve }) => {
                const url = response.url()
                if (url.includes('UserTweets') && response.request().method() === 'GET') {
                    const json = await response.json()
                    tweets_json = json
                    resolve()
                }
            },
        )
        await page.setViewport(config.viewport ?? { width: 954, height: 2 })
        await page.goto(url)
        try {
            await checkLogin(page)
            await checkSomethingWrong(page)
        } catch (error) {
            cleanup()
            throw error
        }
        await waitForTweets
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
        const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { resolve }) => {
            const url = response.url()
            if (url.includes('UserTweetsAndReplies') && response.request().method() === 'GET') {
                const json = await response.json()
                tweets_json = json
                resolve()
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
        await waitForTweets
        return XApiJsonParser.tweetsRepliesParser(tweets_json)
    }

    /**
     * @param url https://x.com/username
     */
    export async function grabFollowsNumer(page: Page, url: string): Promise<GenericFollows> {
        let user_json
        const { cleanup, promise: waitForTweets } = waitForEvent(
            page,
            PageEvent.Response,
            async (response, { resolve }) => {
                const url = response.url()
                if (url.includes('UserByScreenName') && response.request().method() === 'GET') {
                    const json = await response.json()
                    user_json = json
                    resolve()
                }
            },
        )
        await page.setViewport({ width: 1080, height: 2 })
        await page.goto(url)

        await waitForTweets
        return XApiJsonParser.tweetsFollowsParser(user_json)
    }
}
