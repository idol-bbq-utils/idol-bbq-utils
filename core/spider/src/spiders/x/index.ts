import { GenericArticle, Platform, TaskType, TaskTypeResult } from '@/types'
import { BaseSpider } from '../base'
import { Page } from 'puppeteer-core'
import { GraphQL } from './user'

export * as UserPage from './user'
export * from './types'

export class XBaseSpider extends BaseSpider {
    static _BASE_VALID_URL = /(https:\/\/)?(www\.)?x\.com\//
    BASE_URL: string = 'https://x.com/'

    // @ts-ignore
    async crawl() {
        throw new Error('Not implemented')
    }
}

export class XTimeLineSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = new RegExp(XBaseSpider._BASE_VALID_URL.source + /(?<id>\w+)/.source)
    BASE_URL: string = 'https://x.com/'
    NAME: string = 'X TimeLine Spider'

    async crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type: T = 'article' as T,
    ): Promise<Array<TaskTypeResult<T, Platform.X>>> {
        const result = super._match_valid_url(url, XTimeLineSpider)?.groups
        if (!result) {
            throw new Error('Invalid URL')
        }

        if (task_type === 'article') {
            let res = []
            this.log?.info('Trying to grab tweets.')
            res = await GraphQL.grabTweets(page, url)
            this.log?.info('Trying to grab replies.')
            const replies = await GraphQL.grabReplies(
                page,
                super._match_valid_url(url, XTimeLineSpider)?.[0] + '/with_replies',
            )
            return res.concat(replies) as Array<TaskTypeResult<T, Platform.X>>
        }
        if (task_type === 'follows') {
            return [''] as Array<TaskTypeResult<T, Platform.X>>
        }
        return []
    }
}
