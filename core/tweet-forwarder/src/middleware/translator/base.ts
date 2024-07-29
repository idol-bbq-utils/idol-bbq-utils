abstract class BaseTranslator {
    public name = 'base translator'
    constructor() {}
    public abstract init(): Promise<void>
    public abstract translate(text: string): Promise<string>
}

export { BaseTranslator }
