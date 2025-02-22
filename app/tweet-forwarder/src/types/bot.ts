type ByteDance_LLM = 'doubao-pro-128k'
type BigModel_LLM = 'glm-4-flash'
type Google_LLM = 'gemini'
type Deepseek_LLM = 'deepseek-v3'

type OpenAI_Like_LLM = 'openai'
type TranslatorType = Google_LLM | BigModel_LLM | ByteDance_LLM | Deepseek_LLM | OpenAI_Like_LLM

type MediaStorageType = 'no-storage'

interface ITranslatorConfig {
    prompt?: string
    base_url?: string
    name?: string
    model_id?: string
    other_config?: Record<string, any>
}

interface IWebsiteConfig {
    user_agent?: string
    // TODO: random_user_agent?: boolean
    cron?: string
    interval_time?: {
        max: number
        min: number
    }
    translator?: {
        type: TranslatorType
        api_key: string
        config?: ITranslatorConfig
    }
    media?: {
        type: MediaStorageType
        gallery_dl:
            | {
                  path?: string
                  cookie_file?: string
              }
            | boolean
        // TODO
        // ffmpeg?: {
        //     path: string
        // }
        // yt_dl?: {
        //     path: string
        //     cookie_file?: string
        // }
        // TODO s3 storage
        config?: {}
    }
    puppeteer?: {
        timeout?: number
    }
}

interface IForwardToConfig {
    replace_regex?: string | Array<string> | Array<Array<string>>
    block_until?: number | string
}

interface IWebsite {
    domain: string
    paths: Array<string>
    cookie_file?: string
    task_type?: string
    task_title?: string
    config?: IWebsiteConfig
}

enum SourcePlatformEnum {
    X = 'x',
}

enum ForwardPlatformEnum {
    Telegram = 'telegram',
    Bilibili = 'bilibili',
    QQ = 'qq',
}

interface IForwardTo {
    type: ForwardPlatformEnum
    token: string
    chat_id?: string
    bili_jct?: string
    group_id?: string
    url?: string
    config?: IForwardToConfig
}

interface IBotConfig {
    cfg_websites?: IWebsiteConfig
    cfg_forward_to?: IForwardToConfig
    forward_to?: Array<IForwardTo>
    forward_to_merge?: boolean
}
interface IBot {
    name: string
    websites: Array<IWebsite>
    config?: IBotConfig
}
export { ForwardPlatformEnum, SourcePlatformEnum }
export type { IBot, IBotConfig, IWebsite, IWebsiteConfig, IForwardTo, MediaStorageType, ITranslatorConfig }
