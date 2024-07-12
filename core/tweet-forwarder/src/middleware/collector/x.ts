import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { TypedCollector } from './base'
import { X } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets, ITweetDB } from '@/db/x'
import { log } from '@/config'
import dayjs from 'dayjs'

type TaskType = 'tweet' | 'fans'

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
class XCollector extends TypedCollector<ITweetArticle, ISavedArticle> {
    constructor() {
        super()
    }
    public async collect(items: ITweetArticle[], type: TaskType) {
        const tweets = (await Promise.all(items.map(X.saveTweet))).filter((item) => item !== undefined)
        return tweets
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
