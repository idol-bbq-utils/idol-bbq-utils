import type { ForwarderContext, ForwarderMiddleware } from './types'
import { formatTime, getSubtractTime } from '@/utils/time'
import { isStringArrayArray } from '@/utils/typeguards'
import { articleToText } from '@idol-bbq-utils/render'
import { SimpleExpiringCache } from '@idol-bbq-utils/spider'
import type { Article } from '@/db'
import dayjs from 'dayjs'

export class TimeFilterMiddleware implements ForwarderMiddleware {
    readonly name = 'TimeFilter'

    async process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean> {
        const { timestamp, config } = context
        const { block_until } = config

        if (!timestamp) {
            await next()
            return true
        }

        const block_until_date = getSubtractTime(dayjs().unix(), block_until || '30m')

        if (timestamp < block_until_date) {
            context.abortReason = `blocked: can not send before ${formatTime(block_until_date)}`
            return false
        }

        await next()
        return true
    }
}

export class KeywordFilterMiddleware implements ForwarderMiddleware {
    readonly name = 'KeywordFilter'

    async process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean> {
        const { text, article, config } = context
        const { accept_keywords, filter_keywords } = config

        const original_text = accept_keywords || filter_keywords ? articleToText(article) : undefined

        if (accept_keywords && accept_keywords.length > 0) {
            const regex = new RegExp(accept_keywords.join('|'), 'i')
            let blocked = !regex.test(text)
            blocked = original_text ? !regex.test(original_text) : blocked

            if (blocked) {
                context.abortReason = 'blocked: accept keywords not matched'
                return false
            }
        }

        if (filter_keywords && filter_keywords.length > 0) {
            const regex = new RegExp(filter_keywords.join('|'), 'i')
            let blocked = regex.test(text)
            blocked = original_text ? regex.test(original_text) : blocked

            if (blocked) {
                context.abortReason = 'blocked: filter keywords matched'
                return false
            }
        }

        await next()
        return true
    }
}

export class BlockRuleMiddleware implements ForwarderMiddleware {
    readonly name = 'BlockRule'
    private cache: SimpleExpiringCache = new SimpleExpiringCache()

    async process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean> {
        const { article, config } = context
        const { block_rules } = config

        if (!block_rules || block_rules.length === 0 || !article) {
            await next()
            return true
        }

        const blocked = block_rules.some((rule) => this.shouldBlock(article, rule))

        if (blocked) {
            context.abortReason = 'blocked: block rules matched'
            return false
        }

        await next()
        return true
    }

    private shouldBlock(
        article: Article,
        rule: NonNullable<ForwarderContext['config']['block_rules']>[number],
    ): boolean {
        const { platform, task_type = 'article', sub_type = [], block_type = 'none', block_until = '6h' } = rule

        if (platform !== article.platform) {
            return false
        }

        if (task_type !== 'article') {
            return false
        }

        if (block_type === 'none') {
            return false
        }

        if (!sub_type.includes(article.type)) {
            return false
        }

        const cache_key = `${article.platform}::${article.a_id}::block`
        const cached = this.cache.get(cache_key)

        if (!cached && block_type.startsWith('once')) {
            let has_media = false
            if (block_type === 'once.media') {
                let currentArticle: Article | null = article
                while (currentArticle) {
                    if (currentArticle.has_media) {
                        has_media = true
                        break
                    }
                    if (currentArticle.ref && typeof currentArticle.ref === 'object') {
                        currentArticle = currentArticle.ref
                    } else {
                        currentArticle = null
                    }
                }
            }
            if (block_until === 'once' || has_media) {
                this.cache.set(cache_key, block_type, getSubtractTime(dayjs().unix(), block_until))
            }
            return false
        }

        return true
    }
}

export class TextReplaceMiddleware implements ForwarderMiddleware {
    readonly name = 'TextReplace'

    async process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean> {
        const { config } = context
        const { replace_regex } = config

        if (replace_regex) {
            context.text = this.applyReplacements(context.text, replace_regex)
        }

        await next()
        return true
    }

    private applyReplacements(text: string, regexps: string | [string, string] | Array<[string, string]>): string {
        if (typeof regexps === 'string') {
            return text.replace(new RegExp(regexps, 'g'), '')
        }

        if (isStringArrayArray(regexps)) {
            return regexps.reduce((acc, [reg, replace]) => acc.replace(new RegExp(reg, 'g'), replace || ''), text)
        }

        return text.replace(new RegExp(regexps[0], 'g'), regexps.length > 1 ? regexps[1] : '')
    }
}

export class TextChunkMiddleware implements ForwarderMiddleware {
    readonly name = 'TextChunk'

    private readonly SEPARATOR_NEXT = '\n\n----⬇️----'
    private readonly SEPARATOR_PREV = '----⬆️----\n\n'
    private readonly PADDING_LENGTH = 24

    constructor(private basicTextLimit: number = 1000) {}

    async process(context: ForwarderContext, next: () => Promise<void>): Promise<boolean> {
        const { text } = context

        if (text.length <= this.basicTextLimit) {
            context.metadata.set('chunks', [text])
            await next()
            return true
        }

        const textLimit =
            this.basicTextLimit - this.SEPARATOR_NEXT.length - this.SEPARATOR_PREV.length - this.PADDING_LENGTH

        const chunks: string[] = []
        let remaining = text
        let i = 0

        while (remaining.length > this.basicTextLimit) {
            const current = remaining.slice(0, textLimit)
            chunks.push(`${i > 0 ? this.SEPARATOR_PREV : ''}${current}${this.SEPARATOR_NEXT}`)
            remaining = remaining.slice(textLimit)
            i++
        }

        chunks.push(`${i > 0 ? this.SEPARATOR_PREV : ''}${remaining}`)
        context.metadata.set('chunks', chunks)

        await next()
        return true
    }
}
