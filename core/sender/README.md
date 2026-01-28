# `@idol-bbq-utils/sender`

Multi-platform sender service supporting:
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
import { getSender, ForwardTargetPlatformEnum } from '@idol-bbq-utils/sender'

const QQSender = getSender(ForwardTargetPlatformEnum.QQ)
const sender = new QQSender(
    { url: 'http://localhost:5700', group_id: '123456', token: 'your-token' },
    'bot-id',
    logger
)

await sender.init()
await sender.send('Hello, world!', {
    media: [{ media_type: 'photo', path: '/path/to/image.jpg' }]
})
```
