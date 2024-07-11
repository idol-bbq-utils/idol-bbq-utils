import { ArticleTypeEnum, ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { BaseCollector } from './base'
import { createHash } from 'crypto'
import { X } from '@/db'
import { BaseForwarder } from '../forwarder/base'
import { getTweets } from '@/db/x'

type TaskType = 'tweet' | 'fans'

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
            if (tweet.type === ArticleTypeEnum.REF && tweet.ref !== null) {
                const ref_tweet = await getTweets([tweet.ref])
                forward_tweet = ref_tweet && ref_tweet[0]
            }
            // TODO Text convertor
            // TODO Translate plugin
            const text = forward_tweet.text
            for (const forwarder of forwrad_to) {
                forwarder.send(text)
            }
        }
        return this
    }
}

export { XCollector }
