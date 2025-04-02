import { Platform } from '@/types'
import { BaseSpider } from './base'
import { InstagramSpider } from './instagram'
import { XTimeLineSpider } from './x'

namespace Spider {
    export interface SpiderConstructor {
        _VALID_URL: RegExp
        _PLATFORM: Platform
        new (...args: ConstructorParameters<typeof BaseSpider>): BaseSpider
    }

    const spiders: Array<SpiderConstructor> = [XTimeLineSpider, InstagramSpider]

    export function getSpider(url: string): SpiderConstructor | null {
        for (const spider of spiders) {
            if (spider._VALID_URL.test(url)) {
                return spider
            }
        }
        return null
    }

    export function extractBasicInfo(url: string): { u_id: string; platform: Platform } | undefined {
        for (const spider of spiders) {
            const result = spider._VALID_URL.exec(url)
            if (result) {
                return { u_id: result.groups?.id || '', platform: spider._PLATFORM }
            }
        }
        return
    }
}

export { Spider }
