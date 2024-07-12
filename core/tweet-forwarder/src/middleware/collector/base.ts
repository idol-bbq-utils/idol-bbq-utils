import { BaseForwarder } from '../forwarder/base'

abstract class BaseCollector {
    constructor() {}
    public abstract collect(...args: any[]): Promise<any>
    public abstract forward(...args: any[]): Promise<this>
}

abstract class TypedCollector<T, R> extends BaseCollector {
    constructor() {
        super()
    }
    public abstract collect(items: T[], type: string): Promise<R[]>
    public abstract forward(items: R[], forward_to: BaseForwarder[]): Promise<this>
}

export { BaseCollector, TypedCollector }
