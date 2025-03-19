import { Page, PageEvent, PageEvents } from 'puppeteer-core'
import { ITweetArticle } from '../types'
import { checkLogin, checkSomethingWrong } from '.'
import { GenericArticle, Platform } from '@/types'

/**
 * Wait for an event to be emitted by the page
 */
function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { resolve: () => void }) => void,
    timeout: number = 30000,
): { cleanup: () => void; promise: Promise<PageEvents[T]> } {
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

/**
 * @param url https://x.com/username
 * @description grab tweets from user page
 */
export async function grabTweets(
    page: Page,
    url: string,
    config: {
        viewport?: {
            width: number
            height: number
        }
    } = {
        viewport: {
            width: 954,
            height: 1024,
        },
    },
): Promise<Array<GenericArticle<Platform.X>>> {
    let tweets_json
    const { cleanup, promise: waitForTweets } = waitForEvent(
        page,
        PageEvent.Response,
        async (response, { resolve }) => {
            const url = response.url()
            if (url.includes('UserTweets') && response.request().method() === 'GET') {
                const json = await response.json()
                tweets_json = json
                resolve()
            }
        },
    )
    await page.setViewport(config.viewport ?? { width: 954, height: 1024 })
    await page.goto(url)
    try {
        await checkLogin(page)
        await checkSomethingWrong(page)
    } catch (error) {
        cleanup()
        throw error
    }
    const response = await waitForTweets
    console.dir(tweets_json, { depth: null })
    return tweets_json as any
}
