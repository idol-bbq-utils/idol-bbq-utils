import { Platform, TaskType, TaskTypeResult } from '@/types'
import { createLogger, Logger } from '@idol-bbq-utils/log'
import { Page } from 'puppeteer-core'

interface SpiderConstructor {
    _VALID_URL: RegExp
    new (...args: ConstructorParameters<typeof BaseSpider>): BaseSpider
}

abstract class BaseSpider {
    static _VALID_URL: RegExp
    /**
     * Base URL of the spider
     */
    abstract BASE_URL: string
    /**
     * (Optional) Name of the spider
     */
    NAME: string = 'Base Spider'
    log?: Logger
    public abstract crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type?: T,
    ): Promise<TaskTypeResult<T, Platform>>

    constructor(log?: Logger) {
        this.log = log
    }

    init() {
        this.log = this.log?.child({ childService: 'spider', label: this.NAME })
        return this
    }

    _match_valid_url(url: string, matcher: SpiderConstructor): RegExpExecArray | null {
        return matcher._VALID_URL.exec(url)
    }
}

export { BaseSpider, SpiderConstructor }
