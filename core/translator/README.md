# `@idol-bbq-utils/translator`

Multi-provider LLM translation service supporting:
- Google Gemini
- ByteDance Doubao
- BigModel GLM
- DeepSeek
- OpenAI-compatible APIs
- Qwen MT

## Usage

```typescript
import { translatorRegistry } from '@idol-bbq-utils/translator'

const translator = await translatorRegistry.create(
    'Google',
    'your-api-key',
    logger,
    { model_id: 'gemini-2.0-flash' }
)

const translation = await translator.translate('Hello, world!')
```
