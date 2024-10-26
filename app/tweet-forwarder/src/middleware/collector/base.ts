import { Page } from 'puppeteer-core'
import { BaseForwarder } from '../forwarder/base'
abstract class Collector {
    protected bot_name: string = ''
    constructor(bot_name?: string) {
        this.bot_name = bot_name || ''
    }
    // todo plugin
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

export { Collector }
