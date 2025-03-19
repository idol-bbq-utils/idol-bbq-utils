import { Platform, TaskType, TaskTypeResult } from '@/types'
import { Page } from 'puppeteer-core'

interface SpiderConstructor {
    _VALID_URL: RegExp
    new (): BaseSpider
}

abstract class BaseSpider {
    static _VALID_URL: RegExp
    BASE_URL: string = ''
    public abstract crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type?: T,
    ): Promise<Array<TaskTypeResult<T, Platform>>>

    _match_valid_url(url: string, matcher: SpiderConstructor): RegExpExecArray | null {
        return matcher._VALID_URL.exec(url)
    }
}

export { BaseSpider, SpiderConstructor }
