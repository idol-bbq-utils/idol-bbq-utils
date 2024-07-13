import { IBot, IWebsiteConfig } from './bot'

interface IYamlConfig {
  bots: Array<IBot>
  configs?: IWebsiteConfig
}

export { IYamlConfig }
