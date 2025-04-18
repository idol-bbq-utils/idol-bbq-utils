import { BaseTranslator } from './base'
import axios from 'axios'
import { type TranslatorConfig, TranslatorProvider } from '@/types/translator'
import { Logger } from '@idol-bbq-utils/log'

abstract class BaseOpenai extends BaseTranslator {
    public name = 'base openai translator'
    protected BASE_URL = 'https://api.openai.com/v1/chat/completions'
}

class OpenaiLikeLLMTranslator extends BaseOpenai {
    static _PROVIDER = TranslatorProvider.OpenAI
    NAME: string
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super(api_key, log, config)
        this.api_key = api_key
        this.NAME = config?.name || 'Openai-like'
        this.BASE_URL = config?.base_url || this.BASE_URL
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
                ...this.config?.extended_payload,
                model: this.config?.model_id || 'openai',
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

export { OpenaiLikeLLMTranslator }
