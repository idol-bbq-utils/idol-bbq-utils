import { platformArticleMapToActionText, platformNameMap } from '@idol-bbq-utils/spider/const'
import type { Article } from '@/types'
import dayjs from 'dayjs'
import type { GenericFollows, Platform } from '@idol-bbq-utils/spider/types'
import { orderBy } from 'lodash'

type Follows = GenericFollows & {
    created_at: number
}

const TAB = ' '.repeat(4)
function formatTime(unix_timestamp: number) {
    return dayjs.unix(unix_timestamp).format('YYYY-MM-DD HH:mmZ')
}

function parseTranslationContent(article: Article) {
    /***** 翻译原文 *****/
    let content = article.translation || ''
    /***** 翻译原文结束 *****/

    /***** 图片描述翻译 *****/
    let media_translations: Array<string> = []
    for (const [idx, media] of (article.media || []).entries()) {
        if (media.type === 'photo' && media.translation) {
            media_translations.push(`图片${idx + 1} alt: ${media.translation as string}`)
        }
    }
    if (media_translations.length > 0) {
        content = `${content}\n\n${media_translations.join(`\n---\n`)}`
    }
    /***** 图片描述结束 *****/

    /***** extra描述 *****/
    if (article.extra) {
        const extra = article.extra
        if (extra.translation) {
            content = `${content}\n~~~\n${extra.translation}`
        }
    }
    /***** extra描述结束 *****/
    return content
}

function parseRawContent(article: Article) {
    let content = article.content ?? ''
    let raw_alts = []
    for (const [idx, media] of (article.media || []).entries()) {
        if (media.type === 'photo' && media.alt) {
            raw_alts.push(`photo${idx + 1} alt: ${media.alt as string}`)
        }
    }
    if (raw_alts.length > 0) {
        content = `${content}\n\n${raw_alts.join(`\n---\n`)}`
    }
    if (article.extra) {
        const extra = article.extra
        // card parser
        if (extra.content) {
            content = `${content}\n~~~\n${extra.content}`
        }
    }
    return content
}

/**
 * 原文 -> 媒体文件alt -> extra
 */
function articleToText(article: Article) {
    let currentArticle: Article | null = article
    let format_article = ''
    while (currentArticle) {
        const metaline = formatMetaline(currentArticle)
        format_article += `${metaline}`
        if (currentArticle.content) {
            format_article += '\n\n'
        }
        if (currentArticle.translated_by) {
            let translation = parseTranslationContent(currentArticle)
            format_article += `${translation}\n${'-'.repeat(6)}↑${(currentArticle.translated_by || '大模型') + '渣翻'}--↓原文${'-'.repeat(6)}\n`
        }

        /* 原文 */
        let raw_article = parseRawContent(article)
        format_article += `${raw_article}`
        if (currentArticle.ref) {
            format_article += `\n\n${'-'.repeat(12)}\n\n`
        }
        // get ready for next run
        if (currentArticle.ref && typeof currentArticle.ref === 'object') {
            currentArticle = currentArticle.ref
        } else {
            currentArticle = null
        }
        
    }
    return format_article
}

function followsToText(data: Array<[Platform, Array<[Follows, Follows | null]>]>) {
    // follows to texts
    const texts = [] as Array<string>
    // convert to string
    for (let [platform, follows] of data) {
        if (follows.length === 0) {
            continue
        }
        // 按粉丝数量大的排序
        follows = orderBy(follows, (f) => f[0].followers, 'desc')
        const follow = follows[0]
        if (!follow) {
            continue
        }
        const [cur, pre] = follow
        let text_to_send =
            `${platformNameMap[platform]}:\n${pre?.created_at ? `${formatTime(pre.created_at)}\n⬇️\n` : ''}${formatTime(cur.created_at)}\n\n` +
            follows
                .map(([cur, pre]) => {
                    let text = `${cur.username}\n${' '.repeat(4)}`
                    if (pre?.followers) {
                        text += `${pre.followers.toString().padStart(2)}  --->  `
                    }
                    if (cur.followers) {
                        text += `${cur.followers.toString().padEnd(2)}`
                    }
                    const offset = (cur.followers || 0) - (pre?.followers || 0)
                    text += `${TAB}${offset >= 0 ? '+' : ''}${offset.toString()}`
                    return text
                })
                .join('\n')
        texts.push(text_to_send)
    }
    return texts.join('\n\n')
}

function formatMetaline(article: Article) {
    let metaline =
        [article.username, article.u_id, `来自${platformNameMap[article.platform]}`].filter(Boolean).join(TAB) + '\n'
    const action = platformArticleMapToActionText[article.platform][article.type]
    metaline += [formatTime(article.created_at), `${action}：`].join(TAB)
    return metaline
}

export { articleToText, followsToText, formatMetaline, parseRawContent, parseTranslationContent }
