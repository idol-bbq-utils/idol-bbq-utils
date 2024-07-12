import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { Collector, TypedCollector } from './base'
import { X } from '@idol-bbq-utils/spider'
import { X as X_DB } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets, ITweetDB } from '@/db/x'
import { log } from '@/config'
import dayjs from 'dayjs'
import { Page } from 'puppeteer'
import { shuffle } from 'lodash'
import { delay } from '@/utils/time'

type TaskType = 'tweet' | 'fans'
type TaskResult<T extends TaskType> = T extends 'tweet'
    ? Awaited<ReturnType<typeof X_DB.saveTweet>>
    : T extends 'fans'
      ? Awaited<ReturnType<typeof X_DB.saveFans>>
      : never
interface ISavedArticle extends ITweetDB {
    forward_by?: {
        username: string
        ref: number
    }
}

const TAB = ' '.repeat(4)

function formatArticle(article: ISavedArticle) {
    let metaline = [
        article.username,
        article.u_id,
        dayjs(article.timestamp * 1000).format(),
        `${article.type === ArticleTypeEnum.REF ? '引用' : '发布'}推文：`,
    ].join(TAB)
    if (article.forward_by) {
        metaline = `${article.forward_by.username}${TAB}转发推文:\n\n${metaline}`
    }

    let text = article.text

    return [metaline, text].join('\n\n')
}
class XCollector extends Collector {
    public name = 'collector x'
    public async collectAndForward(
        page: Page,
        domain: string,
        paths: string[],
        forward_to: Array<BaseForwarder>,
        config: {
            type?: TaskType
            interval_time?: {
                min: number
                max: number
            }
        },
    ): Promise<this> {
        const { type = 'tweet' } = config
        const _paths = shuffle(paths)
        if (type === 'tweet') {
            for (const path of _paths) {
                log.info(`[${this.name}] grab tweets for ${domain}/${path}`)
                try {
                    const items = (await this.collect(page, `${domain}/${path}`, type)).filter(
                        (item) => item !== undefined,
                    )
                    log.info(`[${this.name}] forward ${items.length} tweets from ${domain}/${path}`)
                    this.forward(items, forward_to)
                } catch (e) {
                    log.error(`[${this.name}] grab tweets failed for ${domain}/${path}: ${e}`)
                }

                if (config.interval_time) {
                    const time = Math.floor(
                        Math.random() * (config.interval_time.max - config.interval_time.min) +
                            config.interval_time.min,
                    )
                    log.info(`[${this.name}] wait for next loop ${time}ms`)
                    await delay(time)
                }
            }
        }

        if (type === 'fans') {
            log.info(`[${this.name}] grab fans for ${domain}`)
            try {
                const profile = await this.collect(page, domain, type)
                // log.info(`[${this.name}] forward ${items.length} fans from ${domain}`)
                // this.forward(items, forward_to)
            } catch (e) {
                log.error(`[${this.name}] grab fans failed for ${domain}: ${e}`)
            }
        }

        return this
    }

    public async collect<T extends TaskType>(page: Page, url: string, type?: T): Promise<Array<TaskResult<T>>> {
        if (type === 'tweet') {
            const res = await X.TweetGrabber.UserPage.grabTweets(page, url)
            log.info(`[${this.name}] grab ${res.length} tweets from ${url}`)
            const tweets = await Promise.all(res.map(X_DB.saveTweet))
            return tweets as Array<TaskResult<T>>
        }

        if (type === 'fans') {
            const fans = await X.TweetGrabber.UserPage.grabFanNumer(page, url)
            log.info(`[${this.name}] grab ${fans.username}'s fans from ${url}`)
            const saved_profile = await X_DB.saveFans(fans.username, fans.u_id, fans.follows, fans.timestamp)
            return [saved_profile] as Array<TaskResult<T>>
        }
        return []
    }
    public async forward(items: Array<ISavedArticle>, forwrad_to: Array<BaseForwarder>) {
        const tweets = items
        for (const tweet of tweets) {
            let forward_tweet = tweet
            let ref_tweet
            if (tweet.type === ArticleTypeEnum.REF && tweet.ref !== null) {
                const _ref_tweet = await getTweets([tweet.ref])
                ref_tweet = _ref_tweet && _ref_tweet[0]
            }
            if (tweet.forward_by) {
                forward_tweet = tweet
            }
            let format_article = formatArticle(forward_tweet)
            const forward_article = ref_tweet ? formatArticle(ref_tweet) : undefined

            if (forward_article) {
                format_article = `${format_article}\n${'-'.repeat(12)}\n${forward_article}`
            }
            // TODO Text convertor
            // TODO Translate plugin
            for (const forwarder of forwrad_to) {
                forwarder.send(format_article).catch((e) => {
                    log.error('forward failed', e)
                })
            }
        }
        return this
    }
}

export { XCollector }
