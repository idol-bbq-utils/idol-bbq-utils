import { log } from '@/config'
import { BaseTranslator } from './base'
import axios from 'axios'

abstract class BaseDoubao extends BaseTranslator {
    public name = 'base doubao translator'
    protected BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
}

class Doubao128KPro extends BaseDoubao {
    public name = 'Doubao-pro-128k'
    private prompt: string
    private api_key: string
    private model_id: string
    constructor(api_key: string, model_id: string, prompt?: string) {
        super()
        this.api_key = api_key
        this.model_id = model_id
        this.prompt = prompt || this.TRANSLATION_PROMPT
    }
    public async init() {
        log.info(`[Doubao] ${this.name} model loaded with prompt ${this.prompt}`)
    }
    public async translate(text: string) {
        const res = await axios.post(
            this.BASE_URL,
            {
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
        return res.data.choices[0].message.content
    }
}

export { Doubao128KPro }
