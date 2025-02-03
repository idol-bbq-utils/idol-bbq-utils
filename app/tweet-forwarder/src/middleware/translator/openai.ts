import { log } from '@/config'
import { BaseTranslator } from './base'
import axios from 'axios'
import { ITranslatorConfig } from '@/types/bot'

abstract class BaseOpenai extends BaseTranslator {
    public name = 'base openai translator'
    protected BASE_URL = 'https://api.openai.com/v1/chat/completions'
}

class OpenaiLike extends BaseOpenai {
    public name = 'Openai-like'
    private prompt: string
    private api_key: string
    private model_id: string
    private other_config: Record<string, any>
    constructor(api_key: string, config?: ITranslatorConfig) {
        super()
        this.api_key = api_key
        this.model_id = config?.model_id || 'deepseek-chat'
        this.prompt = config?.prompt || this.TRANSLATION_PROMPT
        this.name = config?.name || 'Openai-like'
        this.BASE_URL = config?.base_url || this.BASE_URL
        this.other_config = config?.other_config || {}
    }
    public async init() {
        log.info(`[Openai] ${this.name} model loaded with prompt ${this.prompt}`)
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
                ...this.other_config,
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

export { OpenaiLike }
