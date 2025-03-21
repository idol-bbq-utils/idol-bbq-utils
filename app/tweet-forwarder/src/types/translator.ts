import { CommonCfgConfig } from './common'

type ByteDance_LLM = 'doubao-pro-128k'
type BigModel_LLM = 'glm-4-flash'
type Google_LLM = 'gemini'
type Deepseek_LLM = 'deepseek-v3'

type OpenA_Like_LLM = 'openai'

enum TranslatorProvider {
    /**
     * default model id gemini
     */
    Google = 'Google',
    /**
     * default model id glm-4-flash
     */
    BigModel = 'BigModel',
    /**
     * default model id doubao-pro-128k
     */
    ByteDance = 'ByteDance',
    /**
     * default model id deepseek-v3
     */
    Deepseek = 'Deepseek',
    /**
     * default model id openai
     */
    OpenA = 'openai',
}

interface TranslatorConfig extends CommonCfgConfig {
    prompt?: string
    base_url?: string
    name?: string
    model_id?: string
    /**
     * extra config for request body
     */
    extended_payload?: Record<string, any>
}

interface Translator {
    provider: TranslatorProvider
    api_key: string
    cfg_translator?: TranslatorConfig
}

export { TranslatorProvider }
export type { Translator, TranslatorConfig }
