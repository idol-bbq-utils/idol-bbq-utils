import { log } from '@/config'
import { IForwardTo, MediaStorageType, SourcePlatformEnum } from '@/types/bot'
import { formatTime } from '@/utils/time'
import { isStringArrayArray } from '@/utils/typeguards'

const DATE_OFFSET = 1
abstract class BaseForwarder {
    protected token: string
    protected name: string = 'base-forwarder'
    constructor(token: string) {
        this.token = token
    }
    public abstract send(
        text: string,
        props?: {
            media?: Array<{
                source: SourcePlatformEnum
                type: MediaStorageType
                media_type: string
                path: string
            }>
            timestamp?: number
        },
    ): Promise<any>
}

abstract class Forwarder extends BaseForwarder {
    protected config: IForwardTo['config']
    protected block_until_date: number
    constructor(token: string, config: IForwardTo['config']) {
        super(token)
        this.config = config
        this.block_until_date = config?.block_until
            ? new Date(config.block_until).getTime()
            : new Date().setDate(new Date().getDate() - DATE_OFFSET)
        try {
            if (this.config?.replace_regex) {
                log.debug(`checking config replace_regex: ${JSON.stringify(this.config.replace_regex)}`)
                this.textFilter('test', this.config?.replace_regex)
            }
        } catch (e) {
            log.error(`config is invalid for reasone: ${e}`)
            throw e
        }
    }

    public send(...[text, props, ...rest]: Parameters<BaseForwarder['send']>) {
        const { timestamp } = props || {}
        if (timestamp && timestamp < this.block_until_date) {
            log.warn(`blocked: can not send before ${formatTime(this.block_until_date)}`)
            return Promise.resolve()
        }
        log.debug(`[forwarder] [${this.name}] trying to send text`)
        return this.realSend(this.textFilter(text, this.config?.replace_regex), props, ...rest)
    }
    protected abstract realSend(...args: Parameters<BaseForwarder['send']>): ReturnType<BaseForwarder['send']>

    textFilter(text: string, regexps: NonNullable<IForwardTo['config']>['replace_regex']): string {
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
}

export { BaseForwarder, Forwarder }
