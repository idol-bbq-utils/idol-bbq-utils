import { TranslatorConfig, TranslatorProvider } from '@/types/translator'
import { BaseCompatibleModel } from '@/utils/base'
import { Logger } from '@idol-bbq-utils/log'
import { noop } from 'lodash'

const TRANSLATION_ERROR_FALLBACK = '╮(╯-╰)╭非常抱歉无法翻译'
abstract class BaseTranslator extends BaseCompatibleModel {
    static _PROVIDER = TranslatorProvider.None
    protected abstract BASE_URL: string
    protected api_key: string
    log?: Logger
    config?: TranslatorConfig
    protected TRANSLATION_PROMPT = `现在你是一个翻译，接下来会给你日语或英语，请翻译以下日语或英语为简体中文，只输出译文，不要输出原文。如果是带有# hash tag的标签，不需要翻译。如果无法翻译请输出：“${TRANSLATION_ERROR_FALLBACK}”`
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super()
        this.api_key = api_key
        this.log = log
        this.config = config
    }
    async init(): Promise<void> {
        this.log = this.log?.child({ label: this.NAME, subservice: 'translator' })
        this.log?.info(`loaded with prompt ${this.config?.prompt || this.TRANSLATION_PROMPT}`)
        this.log?.debug(`loaded with config ${this.config}`)
    }
    async drop(...args: any[]): Promise<void> {
        noop()
    }
    public abstract translate(text: string): Promise<string>

    static isValidTranslation(text?: string | null): boolean {
        return Boolean(text) && text !== TRANSLATION_ERROR_FALLBACK
    }
}

export { BaseTranslator, TRANSLATION_ERROR_FALLBACK }
