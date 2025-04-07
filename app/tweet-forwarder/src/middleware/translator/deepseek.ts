import { BaseTranslator } from './base'
import axios from 'axios'
import { type TranslatorConfig, TranslatorProvider } from '@/types/translator'
import { Logger } from '@idol-bbq-utils/log'

const RECOMMEND_CONFIGURATIONS = {
    temperature: 1.3, // recommended for translation. ref: https://api-docs.deepseek.com/quick_start/parameter_settings
}

abstract class BaseDeepSeek extends BaseTranslator {
    NAME = 'base deepseek translator'
    protected BASE_URL = 'https://api.deepseek.com/chat/completions'
}

class DeepSeekLLMTranslator extends BaseDeepSeek {
    static _PROVIDER: TranslatorProvider = TranslatorProvider.Deepseek
    NAME: string
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super(api_key, log, config)
        this.api_key = api_key
        this.NAME = config?.name || 'DeepSeek-v3'
        this.BASE_URL = config?.base_url || this.BASE_URL
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
                ...RECOMMEND_CONFIGURATIONS,
                ...this.config?.extended_payload,
                model: this.config?.model_id || 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: this.config?.prompt || this.TRANSLATION_PROMPT,
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

export { DeepSeekLLMTranslator }
