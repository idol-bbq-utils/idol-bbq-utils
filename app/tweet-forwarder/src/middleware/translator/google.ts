import { ChatSession, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { BaseTranslator } from './base'
import { TranslatorConfig, TranslatorProvider } from '@/types/translator'
import { Logger } from '@idol-bbq-utils/log'

class GoogleLLMTranslator extends BaseTranslator {
    static _PROVIDER = TranslatorProvider.Google
    BASE_URL = ''
    NAME = 'Gemini'
    private genAI
    private model
    private prompt: string
    private chat: ChatSession | undefined
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super(api_key, log, config)
        this.genAI = new GoogleGenerativeAI(api_key)
        this.model = this.genAI.getGenerativeModel({
            model: this.config?.model_id || 'gemini-1.0-pro',
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
        this.prompt = config?.prompt || this.TRANSLATION_PROMPT
    }
    public async init() {
        await super.init()
        const chat = await this.model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: this.prompt }],
                },
            ],
        })
        this.chat = chat
    }
    public async translate(text: string) {
        const res = (await this.chat?.sendMessage(text))?.response.text() || ''
        return res
    }
}

export { GoogleLLMTranslator }
