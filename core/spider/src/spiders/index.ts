import { BaseSpider } from './base'
import { InstagramSpider } from './instagram'
import { XTimeLineSpider } from './x'

interface SpiderConstructor {
    _VALID_URL: RegExp
    new (...args: ConstructorParameters<typeof BaseSpider>): BaseSpider
}

const spiders: Array<SpiderConstructor> = [XTimeLineSpider, InstagramSpider]

function getSpider(url: string): SpiderConstructor | null {
    for (const spider of spiders) {
        if (spider._VALID_URL.test(url)) {
            return spider
        }
    }
    return null
}

export { SpiderConstructor, getSpider }
