# `@idol-bbq-utils/forwarder`

Multi-platform forwarder service supporting:
- QQ (OneBot 11 protocol)
- Telegram (via Telegraf)
- Bilibili

## Features

- **Pipeline Middleware System**: Time filtering, keyword filtering, text replacement, chunking
- **Media Support**: Images and videos for QQ/Telegram, images for Bilibili
- **Auto Chunking**: Automatically splits long messages based on platform limits
- **Retry Logic**: Built-in retry mechanism for failed sends

## Usage

```typescript
import { getForwarder, ForwardTargetPlatformEnum } from '@idol-bbq-utils/forwarder'

const QQForwarder = getForwarder(ForwardTargetPlatformEnum.QQ)
const forwarder = new QQForwarder(
    { url: 'http://localhost:5700', group_id: '123456', token: 'your-token' },
    'bot-id',
    logger
)

await forwarder.init()
await forwarder.send('Hello, world!', {
    media: [{ media_type: 'photo', path: '/path/to/image.jpg' }]
})
```
