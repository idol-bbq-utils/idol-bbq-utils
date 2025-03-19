import { TaskType } from '@/types'

interface SpiderConstructor {
    _VALID_URL: RegExp
    new (): BaseSpider
}

abstract class BaseSpider {
    static _VALID_URL: RegExp
    abstract crawl(url: string, task_type?: TaskType): Promise<any>

    _match_valid_url(url: string, matcher: SpiderConstructor): RegExpExecArray | null {
        return matcher._VALID_URL.exec(url)
    }
}

export { BaseSpider, SpiderConstructor }
