import { Logger } from '@idol-bbq-utils/log'
import { AppConfig } from '@idol-bbq-utils/config'

type Ctx = {
    app_config: AppConfig
    logger?: Logger
}

export type { Ctx }