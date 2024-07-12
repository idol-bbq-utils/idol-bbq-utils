interface IWebsiteConfig {
    user_agent?: string
    // TODO: random_user_agent?: boolean
    cron?: string
    interval_time?: {
        max: number
        min: number
    }
}

interface IWebsite {
    domain: string
    paths: Array<string>
    cookie_file?: string
    task_type?: string
    config?: IWebsiteConfig
}

enum ForwardPlatformEnum {
    Telegram = 'telegram',
    Bilibili = 'bilibili',
}

interface IForwardTo {
    type: ForwardPlatformEnum
    token: string
    chat_id?: string
}

interface IBot {
    name: string
    websites: Array<IWebsite>
    forward_to: Array<IForwardTo>
    configs: IWebsiteConfig
}
export { ForwardPlatformEnum }
export type { IBot, IWebsite, IWebsiteConfig, IForwardTo }
