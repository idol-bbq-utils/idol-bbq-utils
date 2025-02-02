import { ArticleTypeEnum, ITweetCard, ITweetExtraWrapper, TweetExtraTypeEnum } from '@idol-bbq-utils/spider/types'
import { Collector } from './base'
import { X } from '@idol-bbq-utils/spider'
import { X as X_DB } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets, ITweetDB } from '@/db/x'
import { log } from '@/config'
import { Page } from 'puppeteer-core'
import { orderBy, shuffle } from 'lodash'
import { delay, formatTime } from '@/utils/time'
import { BaseTranslator } from '../translator/base'
import { pRetry } from '@idol-bbq-utils/utils'
import { IWebsiteConfig, SourcePlatformEnum } from '@/types/bot'
import { cleanMediaFiles, downloadMediaFiles, getMediaType, plainDownloadMediaFile } from '../media'

type TaskType = 'tweet' | 'reply' | 'follows'
type TaskResult<T extends TaskType> = T extends 'tweet'
    ? Exclude<Awaited<ReturnType<typeof X_DB.saveTweet>>, undefined>
    : T extends 'follows'
      ? {
            profile: Awaited<ReturnType<typeof X_DB.saveFollows>>
            recent_profiles: Awaited<ReturnType<typeof X_DB.getPreviousNFollows>>
        }
      : T extends 'reply'
        ? Exclude<Awaited<ReturnType<typeof X_DB.saveReply>>, undefined>
        : never

const TAB = ' '.repeat(4)
class XCollector extends Collector {
    public name = 'collector x'
    constructor(bot_name?: string) {
        super(bot_name)
    }
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
            translator?: BaseTranslator
            task_id?: string
            media?: IWebsiteConfig['media']
        },
    ): Promise<this> {
        const { type = 'tweet', task_id } = config
        const prefix = task_id ? `[${task_id}]` : ''
        const _paths = shuffle(paths)

        // do reply collector, and do reply first
        if (type === 'reply' || type === 'tweet') {
            for (const path of _paths) {
                try {
                    const replies = await this.collect(page, `${domain}/${path}`, 'reply', {
                        task_id: config.task_id,
                    })
                    log.info(
                        `${prefix} [${this.bot_name}] [${this.name}] forward ${replies.length} replies from ${domain}/${path}`,
                    )
                    this.forward(
                        replies.map((thread) => orderBy(thread, ['timestamp'], 'desc')),
                        forward_to,
                        'reply',
                        {
                            translator: config.translator,
                            task_id: config.task_id,
                            media: config.media,
                        },
                    )
                } catch (e) {
                    log.error(
                        `${prefix} [${this.bot_name}] [${this.name}] grab replies failed for ${domain}/${path}: ${e}`,
                    )
                }
                try {
                    const items = await this.collect(page, `${domain}/${path}`, 'tweet', {
                        task_id: config.task_id,
                    })
                    log.info(
                        `${prefix} [${this.bot_name}] [${this.name}] forward ${items.length} tweets from ${domain}/${path}`,
                    )
                    this.forward(orderBy(items, ['timestamp'], 'asc'), forward_to, 'tweet', {
                        translator: config.translator,
                        task_id: config.task_id,
                        title: config.title,
                        media: config.media,
                    })
                } catch (e) {
                    log.error(
                        `${prefix} [${this.bot_name}] [${this.name}] grab tweets failed for ${domain}/${path}: ${e}`,
                    )
                }

                if (config.interval_time) {
                    const time = Math.floor(
                        Math.random() * (config.interval_time.max - config.interval_time.min) +
                            config.interval_time.min,
                    )
                    log.info(`${prefix} [${this.bot_name}] [${this.name}] wait for next loop ${time}ms`)
                    await delay(time)
                }
            }
        }

        if (type === 'follows') {
            let collection = [] as Array<TaskResult<'follows'>>
            for (const path of _paths) {
                try {
                    const res = await this.collect(page, `${domain}/${path}`, type, {
                        task_id: config.task_id,
                    })
                    collection = collection.concat(res)
                } catch (e) {
                    log.error(`${prefix} [${this.bot_name}] [${this.name}] grab follows failed for ${domain}: ${e}`)
                }
            }
            collection = orderBy(collection, ['profile.follows'], ['desc'])
            this.forward(collection, forward_to, 'follows', {
                task_id: config.task_id,
                title: config.title,
            })
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
        const prefix = config?.task_id ? `[${config?.task_id}]` : ''
        if (type === 'tweet') {
            log.info(`${prefix} [${this.bot_name}] [${this.name}] grab tweets for ${url}`)
            const res = await pRetry(() => X.UserPage.grabTweets(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix} [${this.bot_name}] [${this.name}] grab tweets failed for ${url}. remained retry times: ${e.retriesLeft} ${e.originalError.message}`,
                    )
                },
            })
            log.info(`${prefix} [${this.bot_name}] [${this.name}] grab ${res.length} tweets from ${url}`)
            const tweets = []
            // sequential save for avoiding data conflict
            for (const tweet of res) {
                const saved_tweet = await X_DB.saveTweet(tweet)
                tweets.push(saved_tweet)
            }
            return tweets.filter((item) => item !== undefined) as Array<TaskResult<T>>
        }

        if (type === 'reply') {
            log.info(`${prefix} [${this.bot_name}] [${this.name}] grab replies for ${url}`)
            const reply_threads = await pRetry(() => X.UserPage.grabReply(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix} [${this.bot_name}] [${this.name}] grab replies failed for ${url}. remained retry times: ${e.retriesLeft} ${e.originalError.message}`,
                    )
                },
            })
            log.info(
                `${prefix} [${this.bot_name}] [${this.name}] grab ${reply_threads.length} reply threads from ${url}`,
            )
            const res = []
            for (const reply_thread of reply_threads) {
                const saved_thread = await X_DB.saveReply(reply_thread)
                if (!saved_thread) {
                    continue
                }
                let all_thread = []
                let latest_single_article = orderBy(saved_thread, ['timestamp'], 'desc')[0]
                while (latest_single_article && latest_single_article.ref !== null && latest_single_article.ref !== 0) {
                    all_thread.push(latest_single_article)
                    latest_single_article = (await X_DB.getTweets([latest_single_article.ref]))[0]
                }
                all_thread.push(latest_single_article)
                res.push(all_thread)
            }
            return res.filter((item) => item !== undefined) as Array<TaskResult<T>>
        }

        if (type === 'follows') {
            log.info(`${prefix} [${this.bot_name}] [${this.name}] grab follows for ${url}`)
            const follows = await pRetry(() => X.UserPage.grabFollowsNumer(page, url), {
                retries: 2,
                onFailedAttempt: (e) => {
                    log.error(
                        `${prefix} [${this.bot_name}] [${this.name}] grab follows failed for ${url}. remained retry times: ${e.retriesLeft} ${e.originalError.message}`,
                    )
                },
            })
            log.info(`${prefix} [${this.bot_name}] [${this.name}] grab ${follows.username}'s follows from ${url}`)
            const saved_profile = await X_DB.saveFollows(
                follows.username,
                follows.u_id,
                follows.follows,
                follows.timestamp,
            )
            const recent_profiles = await X_DB.getPreviousNFollows(saved_profile.u_id, 5)
            return [{ profile: saved_profile, recent_profiles }] as Array<TaskResult<T>>
        }

        return []
    }
    public async forward<T extends TaskType>(
        items: Array<TaskResult<T>>,
        forward_to: Array<BaseForwarder>,
        type: T,
        config?: {
            translator?: BaseTranslator
            task_id?: string
            title?: string
            media?: IWebsiteConfig['media']
        },
    ) {
        const prefix = config?.task_id ? `[${config?.task_id}]` : ''
        /*** prepare ***/
        let raw_article_groups = []
        if (type === 'tweet') {
            const tweets = items as Array<TaskResult<'tweet'>>
            for (const tweet of tweets) {
                let _articles = [tweet]
                if (tweet.type === ArticleTypeEnum.REF && tweet.ref !== null) {
                    const _ref_tweet = await getTweets([tweet.ref])
                    _ref_tweet && _articles.push(_ref_tweet[0])
                }
                raw_article_groups.push(_articles)
            }
        }

        if (type === 'reply') {
            const threads = items as Array<TaskResult<'reply'>>
            for (const thread of threads) {
                raw_article_groups.push(thread)
            }
        }

        /*** starting forwarding ***/

        // do article forwarding
        if (type === 'tweet' || type === 'reply') {
            for (const articles of raw_article_groups) {
                const DEFAULT_TRANSLATION = '╮(╯-╰)╭非常抱歉无法翻译'
                let formated_article = (
                    await Promise.all(
                        // TODO: extract to function
                        articles.map(async (article) => {
                            let metaline = this.formatMetaline(article)
                            let format_article = `${metaline}\n\n`
                            // add extra content for translated
                            // side effect
                            if (article.extra) {
                                if (
                                    (article.extra as unknown as ITweetExtraWrapper<ITweetCard>).type ===
                                    TweetExtraTypeEnum.CARD
                                ) {
                                    const card = (article.extra as unknown as ITweetExtraWrapper<ITweetCard>).data
                                    article.text += `\n${'~'.repeat(12)}\n`
                                    article.text += `${card.content}\n`
                                    if (card.link) {
                                        article.text += `${card.link}\n`
                                    }
                                }
                            }

                            if (config?.translator) {
                                let translated_article = await X_DB.getTranslation(article.id)
                                if (!translated_article?.translation) {
                                    let text = DEFAULT_TRANSLATION
                                    try {
                                        log.debug(
                                            `${prefix} [${this.bot_name}] [${this.name}] translate for :${article.text}`,
                                        )
                                        text =
                                            (await pRetry(() => config.translator?.translate(article.text), {
                                                retries: 2,
                                                onFailedAttempt: (e) => {
                                                    log.error(
                                                        `${prefix} [${this.bot_name}] [${this.name}] translate failed. remained retry times: ${e.retriesLeft}: ${e.originalError.message}`,
                                                    )
                                                },
                                            })) || DEFAULT_TRANSLATION
                                        log.debug(
                                            `${prefix} [${this.bot_name}] [${this.name}] translated text: ${text}`,
                                        )
                                    } catch (e) {
                                        log.error(`${prefix} [${this.bot_name}] [${this.name}] translate failed: ${e}`)
                                    }
                                    translated_article =
                                        // do not save default translation
                                        text === DEFAULT_TRANSLATION
                                            ? {
                                                  translation: DEFAULT_TRANSLATION,
                                              }
                                            : await X_DB.saveTranslation(article.id, text || '')
                                }
                                format_article += `${translated_article?.translation || ''}\n${'-'.repeat(6)}↑${config.translator.name + '渣翻'}--↓原文${'-'.repeat(6)}\n`
                            }
                            return `${format_article}${article.text}`
                        }),
                    )
                ).join(`\n\n${'-'.repeat(12)}\n\n`)

                if (config?.title) {
                    formated_article = `${config.title}\n${formated_article}`
                }

                // handle image
                let images = [] as string[]
                if (config?.media) {
                    for (const article of articles) {
                        if (article.has_media && article.tweet_link && config.media.gallery_dl) {
                            images = images.concat(
                                downloadMediaFiles(`https://x.com${article.tweet_link}`, config.media.gallery_dl),
                            )
                        }
                        const extra = article.extra as unknown as ITweetExtraWrapper<ITweetCard> | null
                        if (extra && extra.type === TweetExtraTypeEnum.CARD && extra.data.media) {
                            const img = await plainDownloadMediaFile(extra.data.media)
                            if (img) {
                                images.push(img)
                            }
                        }
                    }
                }
                let images_to_send = images.map((path) => ({
                    source: SourcePlatformEnum.X,
                    type: config?.media?.type || 'no-storage',
                    media_type: getMediaType(path),
                    path: path,
                }))

                // async and send
                new Promise(async (res) => {
                    try {
                        log.debug(`${prefix} [${this.bot_name}] [${this.name}] trying to send tweets`)
                        await Promise.all(
                            forward_to.map((forwarder) =>
                                pRetry(
                                    () =>
                                        forwarder.send(formated_article, {
                                            media: images_to_send,
                                            timestamp: articles[0].timestamp * 1000,
                                        }),
                                    { retries: 2 },
                                ),
                            ),
                        )
                        log.debug(`${prefix} [${this.bot_name}] [${this.name}] send tweets finished`)
                        cleanMediaFiles(images)
                        res('')
                    } catch (e) {
                        log.error(`${prefix} [${this.bot_name}] [${this.name}] forward failed: ${e}`)
                        try {
                            cleanMediaFiles(images)
                        } catch (e) {
                            log.error(`${prefix} [${this.bot_name}] [${this.name}] clean media failed: ${e}`)
                        }
                    }
                })
            }
        }

        // unique logic
        if (type === 'follows') {
            const collection = items as Array<TaskResult<'follows'>>
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
                        let text = `${item.username}\n${' '.repeat(4)}`
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
            if (config?.title) {
                text_to_send = `${config.title}\n${text_to_send}`
            }
            for (const forwarder of forward_to) {
                forwarder.send(text_to_send).catch((e) => {
                    log.error(`${prefix} [${this.bot_name}] [${this.name}] forward failed: ${e}`)
                })
            }
        }

        return this
    }

    formatMetaline(
        article: ITweetDB & {
            forward_by?: {
                username: string
                ref: number
            }
        },
    ) {
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

        return metaline
    }
}

export { XCollector }
