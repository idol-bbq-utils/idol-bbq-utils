import { IBot, IBotConfig, IWebsiteConfig } from './bot'

interface IYamlConfig {
    bots: Array<IBot>
    config?: IBotConfig
}

export { IYamlConfig }
