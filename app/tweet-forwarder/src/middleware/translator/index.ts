import { TranslatorProvider } from '@/types/translator'
import { BaseTranslator } from './base'
import { GoogleLLMTranslator } from './google'
import { ByteDanceLLMTranslator } from './bytedance'

interface TranslatorConstructor {
    _PROVIDER: TranslatorProvider
    new (...args: ConstructorParameters<typeof BaseTranslator> & any): BaseTranslator
}

const translators: Array<TranslatorConstructor> = [GoogleLLMTranslator, ByteDanceLLMTranslator]
