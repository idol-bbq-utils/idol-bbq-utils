abstract class BaseTranslator {
    public name = 'base translator'
    protected TRANSLATION_PROMPT = '现在你是一个翻译，接下来会给你日语或英语，请翻译以下日语或英语为简体中文，只输出译文，不要输出原文。如果是带有# hash tag的标签，不需要翻译。如果无法翻译请输出：“╮(╯-╰)╭非常抱歉无法翻译”'
    constructor() {}
    public abstract init(): Promise<void>
    public abstract translate(text: string): Promise<string>
}

export { BaseTranslator }
