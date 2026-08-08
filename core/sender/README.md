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

## Remote media storage

When the sender and OneBot run on different hosts, configure Dufs storage under `cfg_sender.media`. The scheduler uploads each file with HTTP PUT, requests a path-bound download token, and QQ sends the resulting URL instead of a local `file://` URI.

```yaml
config:
  cfg_sender:
    media:
      type: dufs
      upload_url: https://storage.example.com/idol-bbq-media
      public_url: https://media.example.com/idol-bbq-media
      username: idol-bbq
      password: replace-with-a-secret
      use:
        tool: default
```

`upload_url` must target a Dufs directory using HTTP Basic authentication (`auth-method: basic`) and Dufs v0.44.0 or newer. `public_url` defaults to `upload_url`; when it differs, both URLs must resolve to the same Dufs-relative object path so the token remains valid. Dufs does not return an object URL from PUT: the client names files by their SHA-256 content hash, appends that key to both base URLs, then obtains a token through `?tokengen`. Dufs v0.46.0 fixes token validity at three days and does not expire stored files, so configure a server-side cleanup task separately.
