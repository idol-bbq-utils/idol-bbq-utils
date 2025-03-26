import { Logger } from '@idol-bbq-utils/log'

abstract class BaseCompatibleModel {
    abstract NAME: string
    abstract log?: Logger

    abstract init(): Promise<void>
}

export { BaseCompatibleModel }
