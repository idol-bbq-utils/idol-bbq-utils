import * as winston from 'winston'
import { Logger } from 'winston'
import { format } from 'winston'
import dayjs from 'dayjs'
import 'winston-daily-rotate-file'

const { combine, colorize, timestamp, json, printf } = format

const default_format = printf(({ timestamp, level, message, ...meta }) => {
    // Unified format: [trace_id][service][subservice][level]: message
    const metas = [meta['trace_id'], meta['service'], meta['subservice'], level]
        .filter(Boolean)
        .map((m) => `[${m}]`)
        .join('')
    return `${dayjs(timestamp as any).format()} ${metas}: ${typeof message === 'string' ? message : JSON.stringify(message)}`
})

const default_config = {
    level: process.env.LOG_LEVEL || 'info',
    format: combine(colorize(), timestamp(), default_format),
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
}

const default_log = winston.createLogger(default_config)

const createLogger = (config: winston.LoggerOptions) =>
    winston.createLogger({
        ...default_config,
        ...config,
    })

export { default_log, createLogger, Logger, winston, format }
export default default_log
