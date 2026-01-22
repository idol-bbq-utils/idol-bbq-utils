import { RETRY_LIMIT } from '@/config'
import type { Article } from '@/db'
import {
    type ForwardTarget,
    type ForwardTargetPlatformCommonConfig,
    ForwardTargetPlatformEnum,
} from '@/types/forwarder'
import { BaseCompatibleModel } from '@/utils/base'
import { Logger } from '@idol-bbq-utils/log'
import type { MediaType } from '@idol-bbq-utils/spider/types'
import { pRetry } from '@idol-bbq-utils/utils'
import { noop } from 'lodash'
import {
    MiddlewarePipeline,
    TimeFilterMiddleware,
    KeywordFilterMiddleware,
    BlockRuleMiddleware,
    TextReplaceMiddleware,
    TextChunkMiddleware,
    type ForwarderContext,
    type ForwarderMiddleware,
} from './pipeline'

export interface SendProps {
    media?: Array<{
        media_type: MediaType
        path: string
    }>
    timestamp?: number
    runtime_config?: ForwardTargetPlatformCommonConfig
    article?: Article
}

abstract class BaseForwarder extends BaseCompatibleModel {
    static _PLATFORM = ForwardTargetPlatformEnum.None
    log?: Logger
    id: string
    protected config: ForwardTarget['cfg_platform']
    protected pipeline: MiddlewarePipeline

    constructor(config: ForwardTarget['cfg_platform'], id: string, log?: Logger) {
        super()
        this.log = log
        this.config = config
        this.id = String(id)
        this.pipeline = this.createDefaultPipeline()
    }

    async init(): Promise<void> {
        this.log = this.log?.child({ service: 'Forwarder', subservice: this.NAME, label: this.id })
        this.log?.debug(`loaded with config ${this.config}`)
    }

    async drop(..._args: any[]): Promise<void> {
        noop()
    }

    protected createDefaultPipeline(): MiddlewarePipeline {
        return new MiddlewarePipeline()
            .use(new TimeFilterMiddleware())
            .use(new KeywordFilterMiddleware())
            .use(new BlockRuleMiddleware())
            .use(new TextReplaceMiddleware())
            .use(new TextChunkMiddleware(this.getTextLimit()))
    }

    protected getTextLimit(): number {
        return 1000
    }

    public check_blocked(text: string, props: SendProps): boolean {
        const { timestamp, runtime_config, article } = props || {}
        const mergedConfig: ForwardTargetPlatformCommonConfig = {
            ...this.config,
            ...runtime_config,
        }

        const context: ForwarderContext = {
            text,
            article,
            media: props?.media,
            timestamp,
            config: mergedConfig,
            metadata: new Map(),
            aborted: false,
        }

        const blockCheckPipeline = new MiddlewarePipeline()
            .use(new TimeFilterMiddleware())
            .use(new KeywordFilterMiddleware())
            .use(new BlockRuleMiddleware())

        let blocked = false
        blockCheckPipeline
            .execute(context)
            .then((result) => {
                blocked = !result
            })
            .catch(() => {
                blocked = true
            })

        return blocked
    }

    public async send(text: string, props?: SendProps): Promise<any> {
        const { runtime_config } = props || {}
        const mergedConfig: ForwardTargetPlatformCommonConfig = {
            ...this.config,
            ...runtime_config,
        }

        const context: ForwarderContext = {
            text,
            article: props?.article,
            media: props?.media,
            timestamp: props?.timestamp,
            config: mergedConfig,
            metadata: new Map(),
            aborted: false,
        }

        const shouldSend = await this.pipeline.execute(context)

        if (!shouldSend) {
            this.log?.warn(context.abortReason || 'Message blocked by middleware')
            return Promise.resolve()
        }

        const chunks = (context.metadata.get('chunks') as string[]) || [context.text]
        const _log = this.log

        _log?.debug(`trying to send text with length ${context.text.length}`)

        await pRetry(() => this.realSend(chunks, props), {
            retries: RETRY_LIMIT,
            onFailedAttempt(e) {
                _log?.error(`send texts failed, retrying...: ${e.originalError.message}`)
            },
        })
    }

    protected abstract realSend(texts: string[], props?: SendProps): Promise<any>
}

abstract class Forwarder extends BaseForwarder {
    protected BASIC_TEXT_LIMIT = 1000

    constructor(config: ForwardTarget['cfg_platform'], id: string, log?: Logger) {
        super(config, id, log)
        if (this.config?.replace_regex) {
            try {
                this.log?.debug(`checking config replace_regex: ${JSON.stringify(this.config.replace_regex)}`)
                this.validateReplaceRegex(this.config.replace_regex)
            } catch (e) {
                this.log?.error(`replace regex is invalid for reason: ${e}`)
                throw e
            }
        }
    }

    protected override createDefaultPipeline(): MiddlewarePipeline {
        return new MiddlewarePipeline()
            .use(new TimeFilterMiddleware())
            .use(new KeywordFilterMiddleware())
            .use(new BlockRuleMiddleware())
            .use(new TextReplaceMiddleware())
            .use(new TextChunkMiddleware(this.BASIC_TEXT_LIMIT))
    }

    protected override getTextLimit(): number {
        return this.BASIC_TEXT_LIMIT
    }

    private validateReplaceRegex(regexps: ForwardTarget['cfg_platform']['replace_regex']): void {
        if (!regexps) return

        if (typeof regexps === 'string') {
            new RegExp(regexps, 'g')
            return
        }

        if (Array.isArray(regexps)) {
            if (regexps.length > 0 && Array.isArray(regexps[0])) {
                for (const [reg] of regexps as Array<[string, string]>) {
                    new RegExp(reg, 'g')
                }
            } else {
                new RegExp((regexps as [string, string])[0], 'g')
            }
        }
    }
}

export { BaseForwarder, Forwarder }
