import { IBot, IWebsiteConfig } from './bot'

interface IYamlConfig {
    bots: Array<IBot>
    config?: IWebsiteConfig
}

export { IYamlConfig }
