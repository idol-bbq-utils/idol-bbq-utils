import { IYamlConfig } from './types/config'
import fs from 'fs'
import os from 'os'
import YAML from 'yaml'
import { IBot, IWebsiteConfig } from './types/bot'
import { createLogger, Logger, winston } from '@idol-bbq-utils/log'
import dayjs from 'dayjs'

const CACHE_DIR_ROOT = process.env.CACHE_DIR || `${os.tmpdir()}`

class FWDApp {
    public bots: IBot[]
    public config: IWebsiteConfig
    constructor() {
        const yaml = fs.readFileSync('./config.yaml', 'utf8')
        const yaml_cfg = YAML.parse(yaml) as IYamlConfig
        this.bots = yaml_cfg.bots
        this.config = yaml_cfg.config || {}
    }
}

const fwd_app = new FWDApp()

const log: Logger = createLogger({
    defaultMeta: { service: 'tweet-forwarder' },
    level: 'debug',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: `${CACHE_DIR_ROOT}/logs/tweet-forwarder-${dayjs().format('YY-MM-DDTHH_mm_ss')}.log`,
        }),
    ],
})

export { FWDApp, fwd_app, log, CACHE_DIR_ROOT }
