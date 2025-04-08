import * as winston from 'winston'
import { Logger } from 'winston'
import { format } from 'winston'
import dayjs from 'dayjs'
import 'winston-daily-rotate-file'

const { combine, colorize, timestamp, json, printf } = format

const default_format = printf(({ timestamp, level, message, ...meta }) => {
    const service = meta && (meta['service'] ? `[${meta['service']}]` : '')
    return `${dayjs(timestamp as any).format()} ${service} [${level}]: ${JSON.stringify(message)}`
})

const default_config = {
    level: 'info',
    format: combine(colorize(), timestamp(), default_format),
    transports: [new winston.transports.Console()],
}

const default_log = winston.createLogger(default_config)

const createLogger = (config: winston.LoggerOptions) =>
    winston.createLogger({
        ...default_config,
        ...config,
    })

export { default_log, createLogger, Logger, winston, format }
export default default_log
