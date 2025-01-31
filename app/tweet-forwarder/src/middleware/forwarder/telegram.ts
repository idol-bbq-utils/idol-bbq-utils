import { Input, Telegraf } from 'telegraf'
import { Forwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
import { InputMedia, InputMediaPhoto, InputMediaVideo } from 'telegraf/types'

class TgForwarder extends Forwarder {
    private chat_id: string
    private bot: Telegraf
    name = 'telegram'
    constructor(chat_id: string, ...args: [...ConstructorParameters<typeof Forwarder>]) {
        super(...args)
        if (!chat_id) {
            throw new Error(`forwarder ${this.name} chat_id is required`)
        }
        this.chat_id = chat_id
        this.bot = new Telegraf(this.token)
    }
    public async realSend(text: string, props: Parameters<Forwarder['send']>[1]) {
        const { media } = props || {}
        if (media && media.length !== 0) {
            await pRetry(
                () =>
                    this.bot.telegram.sendMediaGroup(
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
                    ),
                {
                    retries: 2,
                    onFailedAttempt(error) {
                        log.error(
                            `Send media to telegram failed. There are ${error.retriesLeft} retries left. ${error.message}`,
                        )
                    },
                },
            )
        } else {
            await pRetry(() => this.bot.telegram.sendMessage(this.chat_id, text), {
                retries: 2,
                onFailedAttempt(error) {
                    log.error(
                        `Send text to telegram failed. There are ${error.retriesLeft} retries left. ${error.message}`,
                    )
                },
            })
        }

        return
    }
}

export { TgForwarder }
