import { TranslatorProvider } from '@/types/translator'
import { BaseTranslator } from './base'
import { GoogleLLMTranslator } from './google'
import { ByteDanceLLMTranslator } from './bytedance'
import { BigModelLLMTranslator } from './bigmodel'
import { DeepSeekLLMTranslator } from './deepseek'
import { OpenaiLikeLLMTranslator } from './openai'
import { QwenMTTranslator } from './qwen'

interface TranslatorConstructor {
    _PROVIDER: TranslatorProvider
    new (...args: ConstructorParameters<typeof BaseTranslator>): BaseTranslator
}

const translators: Array<TranslatorConstructor> = [
    GoogleLLMTranslator,
    ByteDanceLLMTranslator,
    BigModelLLMTranslator,
    DeepSeekLLMTranslator,
    OpenaiLikeLLMTranslator,
    QwenMTTranslator
]

function getTranslator(provider: TranslatorProvider): TranslatorConstructor | null {
    for (const translator of translators) {
        if (translator._PROVIDER.toLowerCase() === provider.toLowerCase()) {
            return translator
        }
    }
    return null
}

export { getTranslator }
export type { TranslatorConstructor }
