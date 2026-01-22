import type { AppConfig } from './types'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { createLogger, Logger, winston, format } from '@idol-bbq-utils/log'
import { getCacheRoot, ensureDirectoryExists } from './utils/directories'

const CACHE_DIR_ROOT = getCacheRoot()
const RETRY_LIMIT = 2

ensureDirectoryExists(CACHE_DIR_ROOT)
ensureDirectoryExists(path.join(CACHE_DIR_ROOT, 'logs'))

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
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(CACHE_DIR_ROOT, 'logs', 'tweet-forwarder-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '3d',
            auditFile: path.join(CACHE_DIR_ROOT, 'logs', '.audit.json'),
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
