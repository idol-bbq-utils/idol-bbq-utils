import { BaseTranslator } from './base'
import axios from 'axios'
import { type TranslatorConfig, TranslatorProvider } from '@/types/translator'
import { Logger } from '@idol-bbq-utils/log'

abstract class BaseQwen extends BaseTranslator {
    public name = 'base qwen translator'
    protected BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
}

class QwenMTTranslator extends BaseQwen {
    static _PROVIDER = TranslatorProvider.QwenMT
    NAME: string
    constructor(api_key: string, log?: Logger, config?: TranslatorConfig) {
        super(api_key, log, config)
        this.api_key = api_key
        this.NAME = config?.name || 'Qwen-MT'
        this.BASE_URL = config?.base_url || this.BASE_URL
    }
    public async translate(text: string) {
        const prompt = this.config?.prompt || this.TRANSLATION_PROMPT
        const res = await axios.post(
            this.BASE_URL,
            {
                model: this.config?.model_id || 'qwen-mt-turbo',
                messages: [
                    {
                        role: 'user',
                        content: `${prompt}\n\n${text}`,
                    },
                ],
                extra_body: {
                    translation_options: {
                        source_lang: 'Japanese',
                        target_lang: 'Chinese',
                    },
                },
                ...this.config?.extended_payload,
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

export { QwenMTTranslator }
