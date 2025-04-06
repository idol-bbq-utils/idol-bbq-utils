import { AppConfig } from './types'
import fs from 'fs'
import os from 'os'
import YAML from 'yaml'
import { createLogger, Logger, winston, format } from '@idol-bbq-utils/log'
import dayjs from 'dayjs'

const CACHE_DIR_ROOT = process.env.CACHE_DIR || `${os.tmpdir()}/tweet-forwarder`
const RETRY_LIMIT = 2

const log: Logger = createLogger({
    defaultMeta: { service: 'tweet-forwarder' },
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        format.printf(({ message, timestamp, level, label, service, subservice, trace_id }) => {
            const metas = [service, subservice, label, level, trace_id]
                .filter(Boolean)
                .map((meta) => `[${meta}]`)
                .join(' ')
            return `${timestamp} ${metas}: ${message}`
        }),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            filename: `${CACHE_DIR_ROOT}/logs/tweet-forwarder-%DATE%.log`,
            datePattern: 'YYYY-MM-DD_HH',
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
})

function configParser(config_path: string) {
    try {
        const yaml = fs.readFileSync(config_path, 'utf8')
        const yaml_cfg = YAML.parse(yaml) as AppConfig
        return yaml_cfg
    } catch (e) {
        log.error(`Error parsing config file: ${e}`)
        return
    }
}

const CONFIG = {}

export { log, configParser, CONFIG, CACHE_DIR_ROOT, RETRY_LIMIT }
