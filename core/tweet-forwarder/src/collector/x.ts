import { ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { BaseCollector } from './base'
import { createHash } from 'crypto'
import { X } from '@/db'

type TaskType = 'tweet' | 'fans'

class XCollector extends BaseCollector<ITweetArticle> {
    constructor() {
        super()
    }
    public async collect(items: ITweetArticle[], type: TaskType) {
        const tweets = (await Promise.all(items.map(X.saveTweet))).filter((item) => item !== undefined)
        console.dir(tweets, {
            depth: null,
        })
        return this
    }
    protected async convert(items: ITweetArticle[], type: TaskType) {
        return []
    }
}

export { XCollector }
