abstract class BaseForwarder {
    constructor() {}
    public abstract send(text: string): Promise<any>
}

export { BaseForwarder }
