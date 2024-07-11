import { BaseForwarder } from '../forwarder/base'

abstract class BaseCollector<T> {
    constructor() {}
    public abstract collect(items: Array<T>, type: string): Promise<Array<number>>
    public abstract forward(items: Array<number>, forwrad_to: Array<BaseForwarder>): Promise<this>
}

export { BaseCollector }
