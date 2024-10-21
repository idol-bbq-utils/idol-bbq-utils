import { log } from '@/config'
import { ChatSession, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { BaseTranslator } from './base'

class Gemini extends BaseTranslator {
    private genAI
    private model
    private prompt: string
    private chat: ChatSession | undefined
    public name = 'Gemini'
    constructor(api_key: string, prompt?: string) {
        super()
        this.genAI = new GoogleGenerativeAI(api_key)
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.0-pro',
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        })
        this.prompt = prompt || this.TRANSLATION_PROMPT
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
