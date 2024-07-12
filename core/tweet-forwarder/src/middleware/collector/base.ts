import { Page } from 'puppeteer'
import { BaseForwarder } from '../forwarder/base'
abstract class Collector {
    public abstract collect(page: Page, url: string, ...args: any[]): Promise<any>
    public abstract forward(...args: any[]): Promise<this>
    public abstract collectAndForward(
        page: Page,
        domain: string,
        paths: string[],
        forward_to: Array<BaseForwarder>,
        ...args: any[]
    ): Promise<this>
}
abstract class TypedCollector<T, R> extends Collector {
    constructor() {
        super()
    }
    public abstract collect(page: Page, url: string): Promise<R[]>
    public abstract forward(items: R[], forward_to: BaseForwarder[]): Promise<this>
}

export { Collector, TypedCollector }
