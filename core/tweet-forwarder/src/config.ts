import { IYamlConfig } from './types/config'
import fs from 'fs'
import YAML from 'yaml'
import { IBot, IWebsiteConfig } from './types/bot'
import { createLogger, Logger, winston } from '@idol-bbq-utils/log'

class FWDApp {
    public bots: IBot[]
    public config: IWebsiteConfig
    constructor() {
        const yaml = fs.readFileSync('./config.yaml', 'utf8')
        const config = YAML.parse(yaml) as IYamlConfig
        this.bots = config.bots
        this.config = config.configs || {}
    }
}

const fwd_app = new FWDApp()

const log: Logger = createLogger({
    defaultMeta: { service: 'tweet-forwarder' },
    level: 'debug',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: `/tmp/logs/tweet-forwarder-${new Date().getTime()}.log`,
        }),
    ],
})

export { FWDApp, fwd_app, log }
