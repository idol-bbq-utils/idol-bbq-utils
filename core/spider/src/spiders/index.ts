import { Platform } from '@/types'
import { BaseSpider, SpiderRegistry, SpiderPriority, type SpiderPlugin } from './base'
import { InstagramSpider } from './instagram'
import { XListSpider, XUserTimeLineSpider } from './x'
import { TiktokSpider } from './tiktok'
import { YoutubeSpider } from './youtube'

const XUserTimelinePlugin: SpiderPlugin = {
    id: 'x-timeline',
    platform: Platform.X,
    priority: SpiderPriority.NORMAL,
    urlPattern: XUserTimeLineSpider._VALID_URL,
    create: (log) => new XUserTimeLineSpider(log).init(),
}

const XListPlugin: SpiderPlugin = {
    id: 'x-list',
    platform: Platform.X,
    priority: SpiderPriority.HIGH,
    urlPattern: XListSpider._VALID_URL,
    create: (log) => new XListSpider(log).init(),
}

const InstagramPlugin: SpiderPlugin = {
    id: 'instagram',
    platform: Platform.Instagram,
    priority: SpiderPriority.NORMAL,
    urlPattern: InstagramSpider._VALID_URL,
    create: (log) => new InstagramSpider(log).init(),
}

const TiktokPlugin: SpiderPlugin = {
    id: 'tiktok',
    platform: Platform.TikTok,
    priority: SpiderPriority.NORMAL,
    urlPattern: TiktokSpider._VALID_URL,
    create: (log) => new TiktokSpider(log).init(),
}

const YoutubePlugin: SpiderPlugin = {
    id: 'youtube',
    platform: Platform.YouTube,
    priority: SpiderPriority.NORMAL,
    urlPattern: YoutubeSpider._VALID_URL,
    create: (log) => new YoutubeSpider(log).init(),
}

const spiderRegistry = SpiderRegistry.getInstance()
    .register(XUserTimelinePlugin)
    .register(XListPlugin)
    .register(InstagramPlugin)
    .register(TiktokPlugin)
    .register(YoutubePlugin)

namespace Spider {
    export interface SpiderConstructor {
        _VALID_URL: RegExp
        _PLATFORM: Platform
        new (...args: ConstructorParameters<typeof BaseSpider>): BaseSpider
    }

    const spiders: Array<SpiderConstructor> = [
        XUserTimeLineSpider,
        XListSpider,
        InstagramSpider,
        TiktokSpider,
        YoutubeSpider,
    ]

    /** @deprecated Use spiderRegistry.findByUrl() instead */
    export function getSpider(url: string): SpiderConstructor | null {
        for (const spider of spiders) {
            if (spider._VALID_URL.test(url)) {
                return spider
            }
        }
        return null
    }

    /** @deprecated Use spiderRegistry.extractBasicInfo() instead */
    export function extractBasicInfo(url: string): { u_id: string; platform: Platform } | undefined {
        return spiderRegistry.extractBasicInfo(url)
    }
}

export { Spider, spiderRegistry }
export * from './base'
export * as X from './x'
export * as Instagram from './instagram'
export * as Tiktok from './tiktok'
export * as Youtube from './youtube'
