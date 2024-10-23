type MediaStorageType = 'no-storage'
type TranslatorType = 'gemini' | 'glm-4-flash'

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
        key: string
        prompt?: string
    }
    media?: {
        type: MediaStorageType
        gallery_dl: {
            path: string
            cookie_file?: string
        }
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
}

interface IBot {
    name: string
    websites: Array<IWebsite>
    forward_to: Array<IForwardTo>
    config: IWebsiteConfig
}
export { ForwardPlatformEnum, SourcePlatformEnum }
export type { IBot, IWebsite, IWebsiteConfig, IForwardTo, MediaStorageType }
