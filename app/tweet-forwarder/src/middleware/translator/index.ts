import { TranslatorProvider } from '@/types/translator'
import { BaseTranslator, TranslatorRegistry, type TranslatorPlugin } from './base'
import { GoogleLLMTranslator } from './google'
import { ByteDanceLLMTranslator } from './bytedance'
import { BigModelLLMTranslator } from './bigmodel'
import { DeepSeekLLMTranslator } from './deepseek'
import { OpenaiLikeLLMTranslator } from './openai'
import { QwenMTTranslator } from './qwen'

const GooglePlugin: TranslatorPlugin = {
    provider: TranslatorProvider.Google,
    create: (apiKey, log, config) => new GoogleLLMTranslator(apiKey, log, config),
}

const ByteDancePlugin: TranslatorPlugin = {
    provider: TranslatorProvider.ByteDance,
    create: (apiKey, log, config) => new ByteDanceLLMTranslator(apiKey, log, config),
}

const BigModelPlugin: TranslatorPlugin = {
    provider: TranslatorProvider.BigModel,
    create: (apiKey, log, config) => new BigModelLLMTranslator(apiKey, log, config),
}

const DeepseekPlugin: TranslatorPlugin = {
    provider: TranslatorProvider.Deepseek,
    create: (apiKey, log, config) => new DeepSeekLLMTranslator(apiKey, log, config),
}

const OpenAIPlugin: TranslatorPlugin = {
    provider: TranslatorProvider.OpenAI,
    create: (apiKey, log, config) => new OpenaiLikeLLMTranslator(apiKey, log, config),
}

const QwenMTPlugin: TranslatorPlugin = {
    provider: TranslatorProvider.QwenMT,
    create: (apiKey, log, config) => new QwenMTTranslator(apiKey, log, config),
}

const translatorRegistry = TranslatorRegistry.getInstance()
    .register(GooglePlugin)
    .register(ByteDancePlugin)
    .register(BigModelPlugin)
    .register(DeepseekPlugin)
    .register(OpenAIPlugin)
    .register(QwenMTPlugin)

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
    QwenMTTranslator,
]

/** @deprecated Use translatorRegistry.find() instead */
function getTranslator(provider: TranslatorProvider): TranslatorConstructor | null {
    for (const translator of translators) {
        if (translator._PROVIDER.toLowerCase() === provider.toLowerCase()) {
            return translator
        }
    }
    return null
}

export { getTranslator, translatorRegistry }
export type { TranslatorConstructor }
