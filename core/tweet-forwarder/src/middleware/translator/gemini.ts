import { log } from '@/config'
import { ChatSession, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'

const TRANSLATION_PROMPT: string =
    '现在你是一个翻译，接下来会给你日语或英语，请翻译以下日语或英语为简体中文，只输出译文，不要输出原文。如果无法翻译请输出：“╮(╯-╰)╭非常抱歉无法翻译”'

class Gemini {
    private genAI
    private model
    private prompt: string
    private chat: ChatSession | undefined
    public name = 'Gemini'
    constructor(api_key: string, prompt?: string) {
        this.genAI = new GoogleGenerativeAI(api_key)
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.0-pro',
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        })
        this.prompt = prompt || TRANSLATION_PROMPT
    }
    public async init() {
        const chat = await this.model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: this.prompt }],
                },
            ],
        })
        this.chat = chat
        log.info(`[Gemini] model loaded with prompt ${this.prompt}`)
    }
    public async translate(text: string) {
        const res = (await this.chat?.sendMessage(text))?.response.text() || ''
        return res
    }
}

export { Gemini }
