import { RETRY_LIMIT } from '@/config'
import { ForwardToPlatformConfig, ForwardToPlatformEnum } from '@/types/forwarder'
import { BaseCompatibleModel } from '@/utils/base'
import { formatTime, getSubtractTime } from '@/utils/time'
import { isStringArrayArray } from '@/utils/typeguards'
import { Logger } from '@idol-bbq-utils/log'
import { pRetry } from '@idol-bbq-utils/utils'
import dayjs from 'dayjs'
import { noop } from 'lodash'

const CHUNK_SEPARATOR_NEXT = '\n\n----⬇️----'
const CHUNK_SEPARATOR_PREV = '----⬆️----\n\n'
const PADDING_LENGTH = 24

abstract class BaseForwarder extends BaseCompatibleModel {
    static _PLATFORM = ForwardToPlatformEnum.None
    log?: Logger
    id: string
    protected config: ForwardToPlatformConfig<ForwardToPlatformEnum>
    constructor(config: ForwardToPlatformConfig<ForwardToPlatformEnum>, id: string, log?: Logger) {
        super()
        this.log = log
        this.config = config
        this.id = String(id)
    }

    async init(): Promise<void> {
        this.log = this.log?.child({ service: 'Forwarder', subservice: this.NAME, label: this.id })
        this.log?.debug(`loaded with config ${this.config}`)
    }

    async drop(...args: any[]): Promise<void> {
        noop()
    }

    public abstract send(
        text: string,
        props?: {
            media?: Array<{
                media_type: string
                // local file path
                path: string
            }>
            timestamp?: number
        },
    ): Promise<any>
}

abstract class Forwarder extends BaseForwarder {
    protected block_until_date: number
    protected BASIC_TEXT_LIMIT = 1000
    TEXT_LIMIT: number
    constructor(config: ForwardToPlatformConfig<ForwardToPlatformEnum>, id: string, log?: Logger) {
        super(config, id, log)
        this.block_until_date = getSubtractTime(dayjs().unix(), config.block_until || '30m')
        if (this.config?.replace_regex) {
            try {
                this.log?.debug(`checking config replace_regex: ${JSON.stringify(this.config.replace_regex)}`)
                this.textFilter('test', this.config?.replace_regex)
            } catch (e) {
                this.log?.error(`replace regex is invalid for reason: ${e}`)
                throw e
            }
        }
        this.TEXT_LIMIT =
            this.BASIC_TEXT_LIMIT - CHUNK_SEPARATOR_NEXT.length - CHUNK_SEPARATOR_PREV.length - PADDING_LENGTH
    }

    async send(text: string, props: Parameters<BaseForwarder['send']>[1]) {
        const { timestamp } = props || {}
        const { replace_regex } = this.config
        if (timestamp && timestamp < this.block_until_date) {
            this.log?.warn(`blocked: can not send before ${formatTime(this.block_until_date)}`)
            return Promise.resolve()
        }
        if (replace_regex) {
            text = this.textFilter(text, replace_regex)
        }
        const _log = this.log
        _log?.debug(`trying to send text with length ${text.length}`)
        return new Promise(async (resolve, reject) => {
            let text_to_be_sent = text
            let i = 0
            let texts = []
            while (text_to_be_sent.length > this.BASIC_TEXT_LIMIT) {
                const current_chunk = text_to_be_sent.slice(0, this.TEXT_LIMIT)
                texts.push(`${i > 0 ? CHUNK_SEPARATOR_PREV : ''}${current_chunk}${CHUNK_SEPARATOR_NEXT}`)
                text_to_be_sent = text_to_be_sent.slice(this.TEXT_LIMIT)
                i = i + 1
            }
            texts.push(`${i > 0 ? CHUNK_SEPARATOR_PREV : ''}${text_to_be_sent}`)
            await pRetry(() => this.realSend(texts, props), {
                retries: RETRY_LIMIT,
                onFailedAttempt(e) {
                    _log?.error(`send texts failed, retrying...: ${e.originalError.message}`)
                },
            }).catch((e) => {
                _log?.error(`send texts failed: ${e.message}`)
            })
            resolve(true)
        })
    }

    textFilter(text: string, regexps: ForwardToPlatformConfig['replace_regex']): string {
        if (!regexps) {
            return text
        }
        if (typeof regexps === 'string') {
            return text.replace(new RegExp(regexps, 'g'), '')
        }

        if (isStringArrayArray(regexps)) {
            return regexps.reduce((acc, [reg, replace]) => acc.replace(new RegExp(reg, 'g'), replace || ''), text)
        }
        return text.replace(new RegExp(regexps[0], 'g'), regexps.length > 1 ? regexps[1] : '')
    }

    protected abstract realSend(
        texts: Array<string>,
        props: Parameters<BaseForwarder['send']>[1],
    ): ReturnType<BaseForwarder['send']>
}

export { BaseForwarder, Forwarder }
