import { BaseCompatibleModel } from '@/utils/base'
import { Logger } from '@idol-bbq-utils/log'
import { CronJob } from 'cron'

abstract class BaseCronManager extends BaseCompatibleModel {
    abstract tasks: Map<string, CronJob>
    log?: Logger
    constructor(log?: Logger) {
        super()
        this.log = log
    }
}

export { BaseCronManager }
