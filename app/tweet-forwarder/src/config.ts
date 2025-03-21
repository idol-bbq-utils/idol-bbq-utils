import { IYamlConfig } from './types'
import fs from 'fs'
import os from 'os'
import YAML from 'yaml'
import { IBot, IBotConfig } from './types/bot'
import { createLogger, Logger, winston, format } from '@idol-bbq-utils/log'
import dayjs from 'dayjs'

const CACHE_DIR_ROOT = process.env.CACHE_DIR || `${os.tmpdir()}`

class FWDApp {
    public bots: IBot[]
    public config: IBotConfig
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
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        format.printf(({ message, timestamp, level, label, service, subservice }) => {
            const metas = [service, subservice, label, level]
                .filter(Boolean)
                .map((meta) => `[${meta}]`)
                .join(' ')
            return `${timestamp} ${metas}: ${message}`
        }),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: `${CACHE_DIR_ROOT}/logs/tweet-forwarder-${dayjs().format('YY-MM-DDTHH_mm_ss')}.log`,
        }),
    ],
})

export { FWDApp, fwd_app, log, CACHE_DIR_ROOT }
