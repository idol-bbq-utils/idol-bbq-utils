import { Input, Telegraf } from 'telegraf'
import { Forwarder } from './base.js'
import type { InputMediaPhoto, InputMediaVideo } from 'telegraf/types'
import { type ForwardToPlatformConfig, ForwardToPlatformEnum } from '@/types/forwarder.js'

class TgForwarder extends Forwarder {
    static _PLATFORM = ForwardToPlatformEnum.Telegram
    BASIC_TEXT_LIMIT = 1024
    NAME = 'telegram'
    private chat_id: string
    private bot: Telegraf

    constructor(...[config, ...rest]: [...ConstructorParameters<typeof Forwarder>]) {
        super(config, ...rest)
        const { chat_id, token } = config as ForwardToPlatformConfig<ForwardToPlatformEnum.Telegram>
        if (!chat_id || !token) {
            throw new Error(`forwarder ${this.NAME} chat_id and bot token is required`)
        }
        this.chat_id = chat_id
        this.bot = new Telegraf(token)
    }
    public async realSend(...[texts, props]: [...Parameters<Forwarder['realSend']>]) {
        const { media } = props || {}
        for (const text of texts) {
            if (media && media.length !== 0) {
                await this.bot.telegram.sendMediaGroup(
                    this.chat_id,
                    media
                        .map((i, idx) => {
                            if (i.media_type === 'photo') {
                                return {
                                    media: Input.fromLocalFile(i.path),
                                    type: 'photo' as InputMediaPhoto['type'],
                                    caption: idx === 0 ? text : undefined,
                                }
                            }
                            if (i.media_type === 'video') {
                                return {
                                    media: Input.fromLocalFile(i.path),
                                    type: 'video' as InputMediaVideo['type'],
                                    caption: idx === 0 ? text : undefined,
                                }
                            }
                            return
                        })
                        .filter((i) => i !== undefined),
                )
            } else {
                await this.bot.telegram.sendMessage(this.chat_id, text)
            }
        }
        return
    }
}

export { TgForwarder }
