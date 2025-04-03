import { AppConfig } from './types'
import fs from 'fs'
import os from 'os'
import YAML from 'yaml'
import { createLogger, Logger, winston, format } from '@idol-bbq-utils/log'
import dayjs from 'dayjs'

const CACHE_DIR_ROOT = process.env.CACHE_DIR || `${os.tmpdir()}`
const RETRY_LIMIT = 2

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

function config_parser(config_path: string) {
    const yaml = fs.readFileSync(config_path, 'utf8')
    const yaml_cfg = YAML.parse(yaml) as AppConfig
    return yaml_cfg
}

const CONFIG = {}

export { log, CONFIG, CACHE_DIR_ROOT, RETRY_LIMIT }
