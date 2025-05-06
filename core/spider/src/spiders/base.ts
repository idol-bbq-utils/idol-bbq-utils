import { Platform, type CrawlEngine, type TaskType, type TaskTypeResult } from '@/types'
import { Logger } from '@idol-bbq-utils/log'
import { Page, type PageEvents } from 'puppeteer-core'
// Replace PageEvent with its literal values
type PageEvent = 'response' | 'request' | 'domcontentloaded' | 'load'
import { Spider } from '.'

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
    public crawl<T extends TaskType>(
        url: string,
        page: Page,
        trace_id?: string,
        config?: {
            task_type?: T
            sub_task_type?: Array<string>
            crawl_engine?: CrawlEngine
        },
    ): Promise<TaskTypeResult<T, Platform>> {
        this.log = this.log?.child({ trace_id })
        return this._crawl(url, page, {
            task_type: 'article' as T,
            crawl_engine: 'browser',
            ...config,
        })
    }

    protected abstract _crawl<T extends TaskType>(
        url: string,
        page: Page,
        config: {
            task_type: T
            crawl_engine: CrawlEngine
            sub_task_type?: Array<string>
        },
    ): Promise<TaskTypeResult<T, Platform>>

    constructor(log?: Logger) {
        this.log = log
    }

    init() {
        this.log = this.log?.child({ subservice: 'spider', label: this.NAME })
        return this
    }

    _match_valid_url(url: string, matcher: Spider.SpiderConstructor): RegExpExecArray | null {
        return matcher._VALID_URL.exec(url)
    }
}

type WaitForEventResponse<T extends PageEvent> =
    | {
          success: true
          res: PageEvents[T]
          data: any | null
      }
    | {
          success: false
          res: PageEvents[T]
          data: any | null
          error: Error
      }

/**
 * Wait for an event to be emitted by the page
 */
function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { done: (data?: any) => void; fail: (error?: Error) => void }) => void,
    timeout: number = 30000,
): {
    promise: Promise<WaitForEventResponse<T>>
    /**
     * Cleanup the event listener manually. You shuold execute this function if error occurs.
     */
    cleanup: () => void
} {
    let promiseResolve: (value: { success: true; data: any; res: PageEvents[T] }) => void
    let promiseReject: (value: { success: false; data: any; res: PageEvents[T]; error: Error }) => void
    let eventData: PageEvents[T]

    const promise = new Promise<WaitForEventResponse<T>>((resolve) => {
        promiseResolve = resolve
        promiseReject = resolve
    })

    const control = {
        done: (data?: any) => {
            cleanup()
            promiseResolve({
                success: true,
                data,
                res: eventData,
            })
        },
        fail: (e: any) => {
            cleanup()
            promiseReject({
                success: false,
                data: null,
                res: eventData,
                error: e,
            })
        },
    }

    const wrappedHandler = (data: PageEvents[T]) => {
        eventData = data
        if (handler) {
            handler(data, control)
        } else {
            control.done(null)
        }
    }

    const timeoutId = setTimeout(() => {
        promiseReject({
            success: false,
            data: null,
            res: eventData,
            error: new Error(`Timeout waiting for event \'${eventName.toString()}\' after ${timeout}ms`),
        })
    }, timeout)

    page.on(eventName, wrappedHandler)

    const cleanup = () => {
        clearTimeout(timeoutId)
        page.off(eventName, wrappedHandler)
    }

    return {
        promise: promise.finally(cleanup),
        cleanup,
    }
}

function waitForResponse(
    page: Page,
    handler?: (
        data: PageEvents['response'],
        control: { done: (data?: any) => void; fail: (reason: any) => void },
    ) => void,
) {
    return waitForEvent(page, 'response', handler)
}

const defaultViewport = {
    width: 1,
    height: 1,
}

export { BaseSpider, waitForEvent, waitForResponse, defaultViewport }
