import { log } from '@/config'
import { BaseTranslator } from './base'
import axios from 'axios'

const RECOMMEND_CONFIGURATIONS = {
    temperature: 1.3, // recommended for translation. ref: https://api-docs.deepseek.com/quick_start/parameter_settings
}

abstract class BaseDeepSeek extends BaseTranslator {
    public name = 'base deepseek translator'
    protected BASE_URL = 'https://api.deepseek.com/chat/completions'
}

class DeepSeekV3 extends BaseDeepSeek {
    public name = 'DeepSeek-v3'
    private prompt: string
    private api_key: string
    private model_id: string
    constructor(api_key: string, model_id?: string, prompt?: string) {
        super()
        this.api_key = api_key
        this.model_id = model_id || 'deepseek-chat'
        this.prompt = prompt || this.TRANSLATION_PROMPT
    }
    public async init() {
        log.info(`[DeepSeek] ${this.name} model loaded with prompt ${this.prompt}`)
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
                ...RECOMMEND_CONFIGURATIONS,
                model: this.model_id,
                messages: [
                    {
                        role: 'system',
                        content: this.prompt,
                    },
                    {
                        role: 'user',
                        content: text,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${this.api_key}`,
                },
            },
        )
        return res.data.choices[0].message.content as string
    }
}

export { DeepSeekV3 }
