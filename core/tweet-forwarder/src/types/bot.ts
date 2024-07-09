interface IWebsiteConfig {
  user_agent?: string
  // TODO: random_user_agent?: boolean
  cron?: string
}

interface IWebsite {
  domain: string
  paths: Array<string>
  cookie_file?: string
  configs?: IWebsiteConfig
}

enum ForwardPlatformEnum {
  Telegram = 'telegram',
  Bilibili = 'bilibili',
}

interface IForwardTo {
  type: ForwardPlatformEnum
  token: string
}

interface IBot {
  bot_name: string
  websites: Array<IWebsite>
  forward_to: Array<IForwardTo>
  configs: IWebsiteConfig
}

export type { IBot, IWebsiteConfig }
