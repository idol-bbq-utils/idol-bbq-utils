import { SpiderConstructor } from './base'
import { XTimeLineSpider } from './x'

const spiders: Array<SpiderConstructor> = [XTimeLineSpider]

export function getSpider(url: string) {
    for (const spider of spiders) {
        if (spider._VALID_URL.test(url)) {
            return spider
        }
    }
    return null
}
