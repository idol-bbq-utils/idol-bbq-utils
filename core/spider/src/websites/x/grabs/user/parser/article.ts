import { ElementHandle } from 'puppeteer'
import { ArticleTypeEnum, ITweetArticle, TimelineTypeEnum } from '@/websites/x/types/types'
import { articleElementParser } from './element'

const QUERY_TEXT_PATTERN = 'div[data-testid="tweetText"]'
const QUERY_META_PATTERN = 'div[data-testid="User-Name"]'
const QUERY_IMG_PATTERN = 'div[data-testid="tweetPhoto"]'
const QUERY_VIDEO_PATTERN = 'div[data-testid="previewInterstitial"]'
const QUERY_CARD_PATTERN = 'div[data-testid="card.wrapper"]'
const QUERY_CARD_VOTE_PATTERN = 'div[data-testid="cardPoll"]'

const QUERY_VIDEO_PATTERN_2 = 'div[data-testid="videoComponent"]'
const QUERY_REF_MEDIA_PATTERN = 'div[data-testid="testCondensedMedia"]'

export async function tweetArticleParser(article: ElementHandle<HTMLElement>): Promise<ITweetArticle | undefined> {
    const article_type = await getArticleTypeEnum(article)
    if ([ArticleTypeEnum.FORWARD, ArticleTypeEnum.TWEET].includes(article_type)) {
        let resolved_article = await singleTweetParser(article, article_type)

        let forward_by = undefined
        let forward_maybe_ref = undefined
        if (article_type === ArticleTypeEnum.FORWARD) {
            const forwarder = await article.$('span[data-testid="socialContext"] span:not(:has(span)')
            forward_by = (await forwarder?.evaluate((e) => e.textContent)) || undefined
            // maybe also ref
            const next = await article?.$('div[aria-labelledby] > div')
            const next_has_meta = await next?.$(QUERY_META_PATTERN)
            if (next_has_meta) {
                forward_maybe_ref = true
                resolved_article = await refTweetParser(article, ArticleTypeEnum.REF)
            }
        }

        return {
            ...resolved_article,
            type: forward_maybe_ref ? ArticleTypeEnum.REF : article_type,
            forward_by,
        }
    }

    // ref tweet
    if (article_type === ArticleTypeEnum.REF) {
        return await refTweetParser(article, article_type)
    }
}

async function refTweetParser(article: ElementHandle<HTMLElement>, article_type: ArticleTypeEnum) {
    let resolved_article = await singleTweetParser(article, article_type)

    const next = await article?.$('div[aria-labelledby] > div')
    const next_has_meta = await next?.$(QUERY_META_PATTERN)
    let ref_article = null
    let has_media = false
    if (next_has_meta) {
        ref_article = next
    } else {
        has_media = (
            await Promise.all([
                next?.$(QUERY_IMG_PATTERN),
                next?.$(QUERY_REF_MEDIA_PATTERN),
                next?.$(QUERY_VIDEO_PATTERN),
                next?.$(QUERY_VIDEO_PATTERN_2),
            ])
        ).some((e) => !!e)
        ref_article = await article?.$('div[aria-labelledby] > div + div')
    }

    // for ref tweet
    let ref = ref_article && (await singleTweetParser(ref_article, ArticleTypeEnum.TWEET))

    return {
        ...resolved_article,
        // this is a little tricky, if next has meta, then it is a ref tweet, otherwise it is photo , video or something
        has_media: has_media && !next_has_meta,
        ref,
    }
}

async function singleTweetParser(article: ElementHandle<HTMLElement>, article_type: ArticleTypeEnum) {
    const [raw_meta, texts] = await Promise.all([
        await article.$(QUERY_META_PATTERN),
        await (await article.$(`${QUERY_TEXT_PATTERN}`))?.$$(':scope > *'),
    ])
    const meta = await tweetMetaParser(raw_meta)
    // article content
    const elements = texts && (await Promise.all(texts?.map(articleElementParser)))
    const partial_href = `/${meta.u_id.slice(1)}/status`
    const _tweet_links = await article?.$$(`a[href*="${partial_href}"`)
    const tweet_links =
        _tweet_links && (await Promise.all(_tweet_links?.map((r) => r?.evaluate((e) => e.getAttribute('href')))))
    const has_media_by_link = tweet_links?.some((l) => l?.includes('photo') || l?.includes('video'))
    const has_media_by_selector = (
        await Promise.all([
            article?.$(QUERY_IMG_PATTERN),
            article?.$(QUERY_REF_MEDIA_PATTERN),
            article?.$(QUERY_VIDEO_PATTERN),
            article?.$(QUERY_VIDEO_PATTERN_2),
        ])
    ).some((e) => !!e)
    const status_link = tweet_links?.[0]?.split('/').slice(0, 4).join('/')
    return {
        ...meta,
        text: elements?.join('') || '',
        type: article_type,
        has_media: has_media_by_link || !!has_media_by_selector,
        tweet_link: status_link,
    }
}

// reply pattern divider article article (show more) ... article
// recommand pattern divider heading follow ... show more divider
export async function tweetReplyParser(
    items: Array<{
        item: ElementHandle<Element>
        type: TimelineTypeEnum
    }>,
) {
    enum StateEnum {
        NORMAL,
        DIVIDER_START,
        REPLY,
    }
    let state: StateEnum = StateEnum.NORMAL
    const reply_articles: Array<Array<ITweetArticle>> = []
    for (const { item, type } of items) {
        switch (state) {
            case StateEnum.NORMAL:
                if (type === TimelineTypeEnum.DIVIDER) {
                    state = StateEnum.DIVIDER_START
                }
                break
            case StateEnum.DIVIDER_START:
                if (type === TimelineTypeEnum.ARTICLE) {
                    const has_line = await item.$('article div[data-testid="Tweet-User-Avatar"] + div')
                    if (has_line) {
                        const article_Wrapper = await item.$('article')
                        const article = article_Wrapper && (await tweetArticleParser(article_Wrapper))
                        if (!article) {
                            throw new Error('article parse error maybe the item is not an article')
                        }
                        reply_articles.push([article])
                        state = StateEnum.REPLY
                    }
                } else if (type === TimelineTypeEnum.DIVIDER) {
                    // do nothing
                } else {
                    state = StateEnum.NORMAL
                }

                break
            case StateEnum.REPLY:
                if (type === TimelineTypeEnum.ARTICLE) {
                    const article_Wrapper = await item.$('article')
                    const article = article_Wrapper && (await tweetArticleParser(article_Wrapper))
                    if (!article) {
                        throw new Error('article parse error maybe the item is not an article')
                    }

                    reply_articles[reply_articles.length - 1].push({
                        ...article,
                        type: ArticleTypeEnum.REPLY,
                    })

                    const has_line = await item.$('article div[data-testid="Tweet-User-Avatar"] + div')
                    if (!has_line) {
                        state = StateEnum.NORMAL
                    }
                }
                if (type === TimelineTypeEnum.SHOW_MORE) {
                    // do nothing
                }
                break
        }
    }
    return reply_articles
}

async function tweetMetaParser(
    info_area: ElementHandle<HTMLElement> | null,
): Promise<Pick<ITweetArticle, 'username' | 'u_id' | 'tweet_link' | 'timestamp'>> {
    if (!info_area) {
        return {
            username: '',
            u_id: '',
            tweet_link: '',
            timestamp: 0,
        }
    }
    // get time & tweet link
    const info_link = await info_area?.$('a[role="link"]:has(time)')
    const tweet_link = await info_link?.evaluate((e) => e.getAttribute('href'))
    // get tweet time
    const time = await info_area?.$('time')
    const iso_time = await time?.evaluate((e) => e.getAttribute('datetime'))
    const timestamp = new Date(iso_time ?? 0).getTime()

    // get username and id
    const username = await (await info_area?.$(':first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
    const id = await (await info_area?.$('div:first-child > span:not(:has(span)'))?.evaluate((e) => e.textContent)
    return {
        username: username || '',
        u_id: id || '',
        tweet_link: tweet_link || '',
        timestamp: Math.floor(timestamp / 1000),
    }
}

async function getArticleTypeEnum(article: ElementHandle<Element>): Promise<ArticleTypeEnum> {
    const is_forward_tweet = await article.$('span[data-testid="socialContext"]')
    if (is_forward_tweet) {
        return ArticleTypeEnum.FORWARD
    }

    const is_ref_tweet = await article.$$(QUERY_TEXT_PATTERN)
    if (is_ref_tweet?.length > 1) {
        return ArticleTypeEnum.REF
    }
    // TODO reply
    return ArticleTypeEnum.TWEET
}
