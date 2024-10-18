import { log } from "@/config";
import { BaseTranslator } from "./base";
import axios from "axios";

enum EnumBigModel {
    GLM4Flash = 'glm-4-flash'
}

abstract class BaseBigModel extends BaseTranslator {
    public name = 'base big model translator'
    protected BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
}

class BigModelGLM4Flash extends BaseBigModel {
    public name = 'GLM-4-Flash'
    private prompt: string
    private api_key: string
    constructor(api_key: string, prompt?: string) {
        super()
        this.api_key = api_key
        this.prompt = prompt || this.TRANSLATION_PROMPT
    }
    public async init() {
        log.info(`[BigModel] ${this.name} model loaded with prompt ${this.prompt}`)
    }
    public async translate(text: string) {
        const res = await axios.post(this.BASE_URL, {
            model: EnumBigModel.GLM4Flash,
            messages: [
                {
                    role: 'system',
                    content: this.prompt
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            max_tokens: 4000
        }, {
            headers: {
                Authorization: `Bearer ${this.api_key}`
            }
        })
        return res.data.choices[0].message.content
    }
}

export { BigModelGLM4Flash }