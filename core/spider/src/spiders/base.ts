import { Platform, TaskType, TaskTypeResult } from '@/types'
import { Logger } from '@idol-bbq-utils/log'
import { Page, PageEvents, PageEvent } from 'puppeteer-core'

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

/**
 * Wait for an event to be emitted by the page
 */
function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { resolve: () => void }) => void,
    timeout: number = 30000,
): {
    /**
     * Cleanup the event listener manually. You shuold execute this function if error occurs.
     */
    cleanup: () => void
    promise: Promise<PageEvents[T]>
} {
    let promiseResolve: (value: PageEvents[T]) => void
    let promiseReject: (reason?: any) => void
    let eventData: PageEvents[T]

    const promise = new Promise<PageEvents[T]>((resolve, reject) => {
        promiseResolve = resolve
        promiseReject = reject
    })

    const cleanup = () => {
        clearTimeout(timeoutId)
        page.off(eventName, wrappedHandler)
    }

    const control = {
        resolve: () => {
            cleanup()
            promiseResolve(eventData)
        },
    }

    const wrappedHandler = (data: PageEvents[T]) => {
        eventData = data
        if (handler) {
            handler(data, control)
        } else {
            control.resolve()
        }
    }

    const timeoutId = setTimeout(() => {
        cleanup()
        promiseReject(new Error(`Timeout waiting for event \'${eventName.toString()}\' after ${timeout}ms`))
    }, timeout)

    page.on(eventName, wrappedHandler)

    return { promise: promise.finally(cleanup), cleanup }
}

function waitForResponse(
    page: Page,
    handler?: (data: PageEvents[PageEvent.Response], control: { resolve: () => void }) => void,
) {
    return waitForEvent(page, PageEvent.Response, handler)
}

export { BaseSpider, SpiderConstructor, waitForEvent, waitForResponse }
