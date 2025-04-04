import { Platform, TaskType, TaskTypeResult } from '@/types'
import { Logger } from '@idol-bbq-utils/log'
import { Page, PageEvents, PageEvent } from 'puppeteer-core'
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
        task_type?: T,
        trace_id?: string,
    ): Promise<TaskTypeResult<T, Platform>> {
        this.log = this.log?.child({ trace_id })
        return this._crawl(url, page, task_type)
    }

    protected abstract _crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type?: T,
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

/**
 * Wait for an event to be emitted by the page
 */
function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { done: () => void; fail: (error?: Error) => void }) => void,
    timeout: number = 30000,
): {
    promise: Promise<{
        success: boolean
        data: PageEvents[T]
        error?: Error
    }>
    /**
     * Cleanup the event listener manually. You shuold execute this function if error occurs.
     */
    cleanup: () => void
} {
    let promiseResolve: (value: { success: boolean; data: PageEvents[T]; error?: Error }) => void
    let promiseReject: (value: { success: boolean; data: PageEvents[T]; error?: Error }) => void
    let eventData: PageEvents[T]

    const promise = new Promise<{
        success: boolean
        data: PageEvents[T]
        error?: Error
    }>((resolve) => {
        promiseResolve = resolve
        promiseReject = resolve
    })

    const control = {
        done: () => {
            cleanup()
            promiseResolve({
                success: true,
                data: eventData,
            })
        },
        fail: (e: any) => {
            cleanup()
            promiseReject({
                success: false,
                data: eventData,
                error: e,
            })
        },
    }

    const wrappedHandler = (data: PageEvents[T]) => {
        eventData = data
        if (handler) {
            handler(data, control)
        } else {
            control.done()
        }
    }

    const timeoutId = setTimeout(() => {
        promiseReject({
            success: false,
            data: eventData,
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
        data: PageEvents[PageEvent.Response],
        control: { done: () => void; fail: (reason: any) => void },
    ) => void,
) {
    return waitForEvent(page, PageEvent.Response, handler)
}

export { BaseSpider, waitForEvent, waitForResponse }
