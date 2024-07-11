import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { BaseCollector } from './base'
import { createHash } from 'crypto'
import { X } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets } from '@/db/x'
import { log } from '@/config'

type TaskType = 'tweet' | 'fans'

const TAB = ' '.repeat(4)

function formatArticle(article: ITweetArticle) {
    let metaline = [
        article.username,
        article.u_id,
        new Date(article.timestamp).toLocaleString('zh'),
        `${article.type === ArticleTypeEnum.REF ? '引用' : '发布'}推文：`,
    ].join(TAB)
    if (article.type === ArticleTypeEnum.FORWARD) {
        metaline = `${article.forward_by} 转发:\n\n${metaline}`
    }

    let text = article.text

    return [metaline, text].join('\n\n')
}
class XCollector extends BaseCollector<ITweetArticle> {
    constructor() {
        super()
    }
    public async collect(items: ITweetArticle[], type: TaskType) {
        const tweets = (await Promise.all(items.map(X.saveTweet))).filter((item) => item !== undefined)
        return tweets
    }
    public async forward(ids: Array<number>, forwrad_to: Array<BaseForwarder>) {
        const tweets = await getTweets(ids)
        for (const tweet of tweets) {
            let forward_tweet = tweet
            let ref_tweet
            if (tweet.type === ArticleTypeEnum.REF && tweet.ref !== null) {
                const _ref_tweet = await getTweets([tweet.ref])
                ref_tweet = _ref_tweet && _ref_tweet[0]
            }
            let format_article = formatArticle(forward_tweet as ITweetArticle)
            const forward_article = ref_tweet ? formatArticle(ref_tweet as ITweetArticle) : undefined

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
