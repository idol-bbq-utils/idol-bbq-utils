abstract class BaseForwarder {
    protected token: string
    constructor(token: string) {
        this.token = token
    }
    public abstract send(text: string): Promise<any>
}

export { BaseForwarder }
