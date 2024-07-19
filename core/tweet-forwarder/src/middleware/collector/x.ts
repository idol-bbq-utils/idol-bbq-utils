import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { Collector, TypedCollector } from './base'
import { X } from '@idol-bbq-utils/spider'
import { X as X_DB } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets, ITweetDB } from '@/db/x'
import { log } from '@/config'
import dayjs from 'dayjs'
import { Page } from 'puppeteer'
import { orderBy, shuffle, transform } from 'lodash'
import { delay, formatTime } from '@/utils/time'
import { Gemini } from '../translator/gemini'
import { pRetry } from '@idol-bbq-utils/utils'

type TaskType = 'tweet' | 'reply' | 'follows'
type TaskResult<T extends TaskType> = T extends 'tweet'
    ? Awaited<ReturnType<typeof X_DB.saveTweet>>
    : T extends 'follows'
      ? Awaited<ReturnType<typeof X_DB.saveFollows>>
      : T extends 'reply'
        ? Awaited<ReturnType<typeof X_DB.saveReply>>
        : never
interface ISavedArticle extends ITweetDB {
    forward_by?: {
        username: string
        ref: number
    }
}

const TAB = ' '.repeat(4)
class ArticleBuilder {}

function formatArticle(article: ISavedArticle) {
    let metaline = [article.username, article.u_id].join(TAB) + '\n'
    metaline =
        metaline +
        [
            formatTime(article.timestamp * 1000),
            `${article.type === ArticleTypeEnum.REF ? '引用' : article.type === ArticleTypeEnum.REPLY ? '回复' : '发布'}推文：`,
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
            title?: string
            interval_time?: {
                min: number
                max: number
            }
            translator?: Gemini
            task_id?: string
        },
    ): Promise<this> {
        const { type = 'tweet', task_id } = config
        const prefix = task_id ? `[${task_id}] ` : ''
        const _paths = shuffle(paths)
        if (type === 'tweet') {
            for (const path of _paths) {
                try {
                    const replies = (
                        await this.collect(page, `${domain}/${path}/with_replies`, 'reply', {
                            task_id: config.task_id,
                        })
                    ).filter((item) => item !== undefined)
                    log.info(`${prefix}[${this.name}] forward ${replies.length} replies from ${domain}/${path}`)
                    this.forwardReply(
                        replies.map((thread) => orderBy(thread, ['timestamp'], 'desc')),
                        forward_to,
                        {
                            translator: config.translator,
                        },
                    )
                } catch (e) {
                    log.error(`${prefix}[${this.name}] grab replies failed for ${domain}/${path}: ${e}`)
                }

                try {
                    const items = (
                        await this.collect(page, `${domain}/${path}`, type, {
                            task_id: config.task_id,
                        })
                    ).filter((item) => item !== undefined)
                    log.info(`${prefix}[${this.name}] forward ${items.length} tweets from ${domain}/${path}`)
                    this.forward(items, forward_to, 'tweet', {
                        translator: config.translator,
                        task_id: config.task_id,
                    })
                } catch (e) {
                    log.error(`${prefix}[${this.name}] grab tweets failed for ${domain}/${path}: ${e}`)
                }

                if (config.interval_time) {
                    const time = Math.floor(
                        Math.random() * (config.interval_time.max - config.interval_time.min) +
                            config.interval_time.min,
                    )
                    log.info(`${prefix}[${this.name}] wait for next loop ${time}ms`)
                    await delay(time)
                }
            }
        }

        if (type === 'reply') {
            for (const path of _paths) {
                try {
                    const replies = (
                        await this.collect(page, `${domain}/${path}/with_replies`, type, {
                            task_id: config.task_id,
                        })
                    ).filter((item) => item !== undefined)
                    log.info(`${prefix}[${this.name}] forward ${replies.length} replies from ${domain}/${path}`)
                    // forward replies
                } catch (e) {
                    log.error(`${prefix}[${this.name}] grab replies failed for ${domain}/${path}: ${e}`)
                }
                if (config.interval_time) {
                    const time = Math.floor(
                        Math.random() * (config.interval_time.max - config.interval_time.min) +
                            config.interval_time.min,
                    )
                    log.info(`${prefix}[${this.name}] wait for next loop ${time}ms`)
                    await delay(time)
                }
            }
        }

        if (type === 'follows') {
            let collection = []
            for (const path of _paths) {
                try {
                    const profile = await this.collect(page, `${domain}/${path}`, type, {
                        task_id: config.task_id,
                    })
                    const recent_profiles = await X_DB.getPreviousNFollows(profile[0].u_id, 5)
                    collection.push({
                        profile: profile[0],
                        recent_profiles,
                    })
                } catch (e) {
                    log.error(`${prefix}[${this.name}] grab follows failed for ${domain}: ${e}`)
                }
            }
            collection = orderBy(collection, ['profile.follows'], ['desc'])
            let prepare_to_forward = []
            for (let item of collection) {
                const username = item.profile.username
                const timestamp = item.profile.timestamp
                let pre_profile
                for (let recent of item.recent_profiles) {
                    if (recent.timestamp < timestamp) {
                        pre_profile = recent
                        break
                    }
                }
                prepare_to_forward.push({
                    username,
                    cur_timestamp: timestamp,
                    pre_timestamp: pre_profile?.timestamp,
                    cur_follows: item.profile.follows,
                    pre_follows: pre_profile?.follows,
                })
            }

            // convert to string
            let text_to_send =
                `${
                    prepare_to_forward[0].pre_timestamp
                        ? formatTime(prepare_to_forward[0].pre_timestamp * 1000) + '\n' + '⬇️' + '\n'
                        : ''
                }${formatTime(prepare_to_forward[0].cur_timestamp * 1000)}\n\n` +
                prepare_to_forward
                    .map((item) => {
                        let text = `${item.username.padEnd(12)}`
                        if (item.pre_follows) {
                            text += `${item.pre_follows.toString().padStart(2)}  --->  `
                        }
                        if (item.cur_follows) {
                            text += `${item.cur_follows.toString().padEnd(2)}`
                        }
                        const offset = (item.cur_follows || 0) - (item.pre_follows || 0)
                        text += `${TAB}${offset >= 0 ? '+' : ''}${offset.toString()}`
                        return text
                    })
                    .join('\n')
            if (config.title) {
                text_to_send = `${config.title}\n${text_to_send}`
            }
            for (const forwarder of forward_to) {
                forwarder.send(text_to_send).catch((e) => {
                    log.error('forward failed', e)
                })
            }
        }

        return this
    }

    public async collect<T extends TaskType>(
        page: Page,
        url: string,
        type?: T,
        config?: {
            task_id?: string
        },
    ): Promise<Array<TaskResult<T>>> {
        const prefix = config?.task_id ? `[${config?.task_id}] ` : ''
        if (type === 'tweet') {
            log.info(`${prefix}[${this.name}] grab tweets for ${url}`)
            const res = await pRetry(() => X.TweetGrabber.UserPage.grabTweets(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix}[${this.name}] grab tweets failed for ${url}. remained retry times: ${e.retriesLeft} ${e.message}`,
                    )
                },
            })
            log.info(`${prefix}[${this.name}] grab ${res.length} tweets from ${url}`)
            const tweets = await Promise.all(res.map(X_DB.saveTweet))
            return tweets as Array<TaskResult<T>>
        }

        if (type === 'follows') {
            log.info(`${prefix}[${this.name}] grab follows for ${url}`)
            const follows = await pRetry(() => X.TweetGrabber.UserPage.grabFollowsNumer(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix}[${this.name}] grab follows failed for ${url}. remained retry times: ${e.retriesLeft} ${e.message}`,
                    )
                },
            })
            log.info(`${prefix}[${this.name}] grab ${follows.username}'s follows from ${url}`)
            const saved_profile = await X_DB.saveFollows(
                follows.username,
                follows.u_id,
                follows.follows,
                follows.timestamp,
            )
            return [saved_profile] as Array<TaskResult<T>>
        }

        if (type === 'reply') {
            log.info(`${prefix}[${this.name}] grab replies for ${url}`)
            const reply_threads = await pRetry(() => X.TweetGrabber.UserPage.grabReply(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix}[${this.name}] grab replies failed for ${url}. remained retry times: ${e.retriesLeft} ${e.message}`,
                    )
                },
            })
            log.info(`${prefix}[${this.name}] grab ${reply_threads.length} reply threads from ${url}`)
            const res = []
            for (const reply_thread of reply_threads) {
                const saved_thread = await X_DB.saveReply(reply_thread)
                res.push(saved_thread)
            }
            return res as Array<TaskResult<T>>
        }
        return []
    }
    public async forward(
        items: Array<ISavedArticle>,
        forwrad_to: Array<BaseForwarder>,
        type: TaskType = 'tweet',
        config?: {
            translator?: Gemini
            task_id?: string
        },
    ) {
        const prefix = config?.task_id ? `[${config?.task_id}] ` : ''
        const tweets = items
        for (const tweet of tweets) {
            let forward_tweet = tweet
            let ref_tweet: undefined | ISavedArticle
            if (tweet.type === ArticleTypeEnum.REF && tweet.ref !== null) {
                const _ref_tweet = await getTweets([tweet.ref])
                ref_tweet = _ref_tweet && _ref_tweet[0]
            }
            let format_article = formatArticle(forward_tweet)
            if (config?.translator) {
                let translated_article = await X_DB.getTranslation(forward_tweet.id)
                if (!translated_article) {
                    let text = '╮(╯-╰)╭非常抱歉无法翻译'
                    try {
                        text =
                            (await pRetry(() => config.translator?.translate(tweet.text), {
                                retries: 2,
                                onFailedAttempt: (e) => {
                                    log.error(
                                        `${prefix}translate failed. remained retry times: ${e.retriesLeft}`,
                                        e.message,
                                    )
                                },
                            })) || '╮(╯-╰)╭非常抱歉无法翻译'
                    } catch (e) {
                        log.error(`${prefix}translate failed`, e)
                    }
                    translated_article = await X_DB.saveTranslation(forward_tweet.id, text || '')
                }
                format_article += `\n${'-'.repeat(6)}${config.translator.name + '渣翻'}${'-'.repeat(6)}\n${translated_article.text}`
            }

            if (ref_tweet) {
                const ref_article = formatArticle(ref_tweet)
                format_article = `${format_article}\n\n${'-'.repeat(12)}\n\n${ref_article}`
                if (config?.translator) {
                    let translated_article = await X_DB.getTranslation(ref_tweet.id)
                    if (!translated_article) {
                        let text = '╮(╯-╰)╭非常抱歉无法翻译'
                        try {
                            text =
                                (await pRetry(() => config.translator?.translate(ref_tweet.text), {
                                    retries: 2,
                                    onFailedAttempt: (e) => {
                                        log.error(
                                            `${prefix}translate failed. remained retry times: ${e.retriesLeft}`,
                                            e.message,
                                        )
                                    },
                                })) || '╮(╯-╰)╭非常抱歉无法翻译'
                        } catch (e) {
                            log.error(`${prefix}translate failed`, e)
                        }
                        translated_article = await X_DB.saveTranslation(ref_tweet.id, text || '')
                    }
                    format_article += `\n${'-'.repeat(6)}${config.translator.name + '渣翻'}${'-'.repeat(6)}\n${translated_article.text}`
                }
            }
            // TODO Text convertor
            // TODO Translate plugin
            for (const forwarder of forwrad_to) {
                forwarder.send(format_article).catch((e) => {
                    log.error(`${prefix}forward failed`, e)
                })
            }
        }
        return this
    }

    async forwardReply(
        threads: Array<Exclude<TaskResult<'reply'>, undefined>>,
        forward_to: Array<BaseForwarder>,
        config?: {
            translator?: Gemini
            task_id?: string
        },
    ) {
        const prefix = config?.task_id ? `[${config?.task_id}] ` : ''
        for (const thread of threads) {
            let format_thread = (
                await Promise.all(
                    thread.map(async (article) => {
                        let format_article = formatArticle(article)
                        if (config?.translator) {
                            let translated_article = await X_DB.getTranslation(article.id)
                            log.debug(`${prefix}`, translated_article)
                            if (!translated_article) {
                                let text = '╮(╯-╰)╭非常抱歉无法翻译'
                                try {
                                    text =
                                        (await pRetry(() => config.translator?.translate(article.text), {
                                            retries: 2,
                                            onFailedAttempt: (e) => {
                                                log.error(
                                                    `${prefix}translate failed. remained retry times: ${e.retriesLeft}`,
                                                    e,
                                                )
                                            },
                                        })) || '╮(╯-╰)╭非常抱歉无法翻译'
                                } catch (e) {
                                    log.error(`${prefix}translate failed`, e)
                                }
                                translated_article = await X_DB.saveTranslation(article.id, text || '')
                            }
                            format_article += `\n${'-'.repeat(6)}${config.translator.name + '渣翻'}${'-'.repeat(6)}\n${translated_article.text}`
                        }
                        return format_article
                    }),
                )
            ).join(`\n\n${'-'.repeat(12)}\n\n`)
            for (const forwarder of forward_to) {
                forwarder.send(format_thread).catch((e) => {
                    log.error(`${prefix}forward failed`, e)
                })
            }
        }
    }
}

export { XCollector }
