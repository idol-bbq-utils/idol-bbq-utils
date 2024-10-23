import { ElementHandle } from 'puppeteer-core'
import { TimelineTypeEnum } from '@/websites/x/types/types'

const QUERY_DIVIDER_PATTERN = ':scope > div:not(:has(*))'
const QUERY_DIVIDER_PATTERN_2 = ':scope > div > div:not(:has(*))'
const QUERY_HEADING_PATTERN = 'h2[role="heading"]'
const QUERY_FOLLOW_RECOMMEND_PATTERN = 'button[data-testid="UserCell"]'

const QUERY_WEAK_SHOW_MORE_PATTERN = 'a[role="link"]'

async function getTimelineType(item: ElementHandle<Element>) {
    const has_article = await item.$('article')
    if (has_article) {
        return TimelineTypeEnum.ARTICLE
    }
    const dividers = await Promise.all([item.$(QUERY_DIVIDER_PATTERN), item.$(QUERY_DIVIDER_PATTERN_2)])
    if (dividers.some((d) => d)) {
        return TimelineTypeEnum.DIVIDER
    }
    const heading = await item.$(QUERY_HEADING_PATTERN)
    if (heading) {
        return TimelineTypeEnum.HEADING
    }
    const follow_recommend = await item.$(QUERY_FOLLOW_RECOMMEND_PATTERN)
    if (follow_recommend) {
        return TimelineTypeEnum.FOLLOW_RECOMMEND
    }

    // this must be matched last
    const show_more = await item.$(QUERY_WEAK_SHOW_MORE_PATTERN)
    if (show_more) {
        return TimelineTypeEnum.SHOW_MORE
    }
    return TimelineTypeEnum.DEFAULT
}

export { getTimelineType }
