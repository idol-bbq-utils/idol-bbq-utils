import { ArticleElementTypeEnum } from '@/spiders/x_oldschool/types'
import { ElementHandle } from 'puppeteer-core'

async function articleElementParser(element: ElementHandle<Element>) {
    const element_type = await getArticleElementTypeEnum(element)
    switch (element_type) {
        case ArticleElementTypeEnum.TEXT:
            return await element.evaluate((e) => e.textContent)
        case ArticleElementTypeEnum.EMOJI:
            return await element.evaluate((e) => e.getAttribute('alt'))
        case ArticleElementTypeEnum.HASH_TAG:
            const tag_a = await element.$('a')
            return await tag_a?.evaluate((e) => e.textContent)
        case ArticleElementTypeEnum.LINK:
            return await element.evaluate((e) => e.textContent)
    }
}

async function getArticleElementTypeEnum(element: ElementHandle<Element>): Promise<ArticleElementTypeEnum> {
    const tag_name = await element.evaluate((e) => e.tagName)

    if (tag_name === 'SPAN') {
        const contain_hash_tag = await element.$('a')
        if (contain_hash_tag) {
            return ArticleElementTypeEnum.HASH_TAG
        } else {
            return ArticleElementTypeEnum.TEXT
        }
    }
    if (tag_name === 'IMG') {
        return ArticleElementTypeEnum.EMOJI
    }
    if (tag_name === 'A') {
        return ArticleElementTypeEnum.LINK
    }
    return ArticleElementTypeEnum.TEXT
}

export { articleElementParser }
