import { TaskType } from '@/types'
import { BaseSpider, SpiderConstructor } from '../base'

export * as UserPage from './user'
export * from './types'

export class XBaseSpider extends BaseSpider {
    static _BASE_VALID_URL = /(https:\/\/)?(www\.)?x\.com\//
    async crawl() {
        throw new Error('Not implemented')
    }
}

export class XTimeLineSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = new RegExp(XBaseSpider._BASE_VALID_URL.source + /(?<id>\w+)/.source)

    async crawl(url: string, task_type: TaskType = 'article'): Promise<string> {
        const id = super._match_valid_url(url, XTimeLineSpider)?.groups?.id
        return id || ''
    }
}
