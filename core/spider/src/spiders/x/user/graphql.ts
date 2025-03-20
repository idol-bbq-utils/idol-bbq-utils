import { Page, PageEvent, PageEvents } from 'puppeteer-core'
import { ArticleTypeEnum } from '../types'
import { checkLogin, checkSomethingWrong } from '.'
import { GenericArticle, Platform } from '@/types'
import { JSONPath } from 'jsonpath-plus'

/**
 * Wait for an event to be emitted by the page
 */
function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { resolve: () => void }) => void,
    timeout: number = 30000,
): {
    /**
     * Cleanup the event listener manually. You shuold execute this function if error occurs.
     */
    cleanup: () => void
    promise: Promise<PageEvents[T]>
} {
    let promiseResolve: (value: PageEvents[T]) => void
    let promiseReject: (reason?: any) => void
    let eventData: PageEvents[T]

    const promise = new Promise<PageEvents[T]>((resolve, reject) => {
        promiseResolve = resolve
        promiseReject = reject
    })

    const cleanup = () => {
        clearTimeout(timeoutId)
        page.off(eventName, wrappedHandler)
    }

    const control = {
        resolve: () => {
            cleanup()
            promiseResolve(eventData)
        },
    }

    const wrappedHandler = (data: PageEvents[T]) => {
        eventData = data
        if (handler) {
            handler(data, control)
        } else {
            control.resolve()
        }
    }

    const timeoutId = setTimeout(() => {
        cleanup()
        promiseReject(new Error(`Timeout waiting for event \'${eventName.toString()}\' after ${timeout}ms`))
    }, timeout)

    page.on(eventName, wrappedHandler)

    return { promise: promise.finally(cleanup), cleanup }
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
    const { cleanup, promise: waitForTweets } = waitForEvent(
        page,
        PageEvent.Response,
        async (response, { resolve }) => {
            const url = response.url()
            if (url.includes('UserTweetsAndReplies') && response.request().method() === 'GET') {
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
    return XApiJsonParser.tweetsRepliesParser(tweets_json)
}
export namespace XApiJsonParser {
    function santiizeTweetsJson(json: any) {
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
            return {
                type,
                url:
                    type === 'photo'
                        ? media_url_https
                        : // @ts-ignore
                          video_info?.variants?.filter((i) => i.bitrate).sort((a, b) => b.bitrate - a.bitrate)[0].url,
                alt: ext_alt_text,
            }
        })
    }

    function tweetParser(result: any): GenericArticle<Platform.X> {
        const legacy = result.legacy
        const userLegacy = result.core?.user_results?.result?.legacy
        const card = result.card
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
            created_at: parseTwitterDate(legacy?.created_at),
            content: legacy?.full_text,
            url: userLegacy?.screen_name ? `/${userLegacy.screen_name}/status/${legacy?.id_str}` : '',
            type: result.quoted_status_result?.result ? ArticleTypeEnum.QUOTED : ArticleTypeEnum.TWEET,
            ref: result.quoted_status_result?.result
                ? tweetParser(result.quoted_status_result.result)
                : result.retweeted_status_result?.result
                  ? tweetParser(result.retweeted_status_result.result)
                  : null,
            media: mediaParser(legacy?.entities?.media || legacy?.extended_entities?.media),
            extra: cardParser(result.card?.legacy),
        }

        // 处理转发类型
        if (legacy?.retweeted_status_result) {
            tweet.type = ArticleTypeEnum.RETWEET
            tweet.content = ''
            tweet.ref = tweetParser(legacy.retweeted_status_result.result)
        }

        if (tweet.media) {
            for (const { url } of legacy.entities.media) {
                tweet.content = tweet.content.replace(url, '')
            }
        }
        return tweet
    }

    export function tweetsArticleParser(json: any) {
        let tweets = santiizeTweetsJson(json)
        tweets = tweets
            .filter((t: { entryId: string }) => t.entryId.startsWith('tweet-'))
            .map((t: { content: any }) => t.content?.itemContent?.tweet_results?.result)
            .filter(Boolean)
        return tweets.map(tweetParser)
    }

    export function tweetsRepliesParser(json: any) {
        const tweets = santiizeTweetsJson(json)
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
}
