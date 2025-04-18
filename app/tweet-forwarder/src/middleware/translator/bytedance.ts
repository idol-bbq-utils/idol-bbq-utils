import { BaseTranslator } from './base'
import axios from 'axios'
import { TranslatorProvider, type TranslatorConfig } from '@/types/translator'
import { Logger } from '@idol-bbq-utils/log'

class ByteDanceLLMTranslator extends BaseTranslator {
    static _PROVIDER = TranslatorProvider.ByteDance
    protected BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
    NAME: string
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super(api_key, log, config)
        this.NAME = this.config?.name || 'Doubao'
        this.BASE_URL = this.config?.base_url || this.BASE_URL
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
                ...this.config?.extended_payload,
                model: this.config?.model_id || 'doubao-pro-128k',
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
        return res.data.choices[0].message.content
    }
}

export { ByteDanceLLMTranslator }
