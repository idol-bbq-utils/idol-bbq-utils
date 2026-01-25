import { Logger } from '@idol-bbq-utils/log'

interface Droppable {
    drop(...args: any[]): Promise<void>
}

export abstract class BaseCompatibleModel implements Droppable {
    abstract NAME: string
    protected abstract log?: Logger

    abstract init(...args: any[]): Promise<void>
    abstract drop(...args: any[]): Promise<void>
}
