import { Platform, type CrawlEngine, type TaskType, type TaskTypeResult } from '@/types'
import { Logger } from '@idol-bbq-utils/log'
import { Page, type PageEvents } from 'puppeteer-core'
type PageEvent = 'response' | 'request' | 'domcontentloaded' | 'load'

export enum SpiderPriority {
    LOWEST = 1,
    LOW = 2,
    NORMAL = 3,
    HIGH = 4,
    HIGHEST = 5,
}

export interface SpiderPlugin {
    id: string
    platform: Platform
    priority: SpiderPriority
    urlPattern: RegExp
    create: (log?: Logger) => BaseSpider
}

class SpiderRegistry {
    private static instance: SpiderRegistry
    private plugins: Map<string, SpiderPlugin> = new Map()

    private constructor() {}

    static getInstance(): SpiderRegistry {
        if (!SpiderRegistry.instance) {
            SpiderRegistry.instance = new SpiderRegistry()
        }
        return SpiderRegistry.instance
    }

    register(plugin: SpiderPlugin): this {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Spider plugin ${plugin.id} already registered`)
        }
        this.plugins.set(plugin.id, plugin)
        return this
    }

    findByUrl(url: string): SpiderPlugin | null {
        const matches = Array.from(this.plugins.values())
            .filter((p) => p.urlPattern.test(url))
            .sort((a, b) => b.priority - a.priority)

        return matches[0] || null
    }

    findById(id: string): SpiderPlugin | null {
        return this.plugins.get(id) || null
    }

    findByPlatform(platform: Platform): SpiderPlugin[] {
        return Array.from(this.plugins.values()).filter((p) => p.platform === platform)
    }

    extractBasicInfo(url: string): { u_id: string; platform: Platform } | undefined {
        const plugin = this.findByUrl(url)
        if (!plugin) return undefined

        const match = plugin.urlPattern.exec(url)
        if (match?.groups?.id) {
            return {
                u_id: match.groups.id,
                platform: plugin.platform,
            }
        }
        return undefined
    }

    getRegisteredPlugins(): SpiderPlugin[] {
        return Array.from(this.plugins.values())
    }
}

abstract class BaseSpider {
    static _VALID_URL: RegExp
    abstract BASE_URL: string
    NAME: string = 'Base Spider'
    log?: Logger

    public crawl<T extends TaskType>(
        url: string,
        page: Page | undefined,
        trace_id?: string,
        config?: {
            task_type?: T
            sub_task_type?: Array<string>
            crawl_engine?: CrawlEngine
            cookieString?: string
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
        page: Page | undefined,
        config: {
            task_type: T
            crawl_engine: CrawlEngine
            sub_task_type?: Array<string>
            cookieString?: string
        },
    ): Promise<TaskTypeResult<T, Platform>>

    constructor(log?: Logger) {
        this.log = log
    }

    init() {
        this.log = this.log?.child({ subservice: 'spider', label: this.NAME })
        return this
    }

    _match_valid_url(url: string, matcher: { _VALID_URL: RegExp }): RegExpExecArray | null {
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

function waitForEvent<T extends PageEvent>(
    page: Page,
    eventName: T,
    handler?: (data: PageEvents[T], control: { done: (data?: any) => void; fail: (error?: Error) => void }) => void,
    timeout: number = 30000,
): {
    promise: Promise<WaitForEventResponse<T>>
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

export { BaseSpider, SpiderRegistry, waitForEvent, waitForResponse, defaultViewport }
