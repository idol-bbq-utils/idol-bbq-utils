import { Input, Telegraf } from 'telegraf'
import { BaseForwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
import { InputMedia, InputMediaPhoto, InputMediaVideo } from 'telegraf/types'

class TgForwarder extends BaseForwarder {
    private chat_id: string
    private bot: Telegraf
    name = 'telegram'
    constructor(token: string, chat_id: string) {
        super(token)
        if (!chat_id) {
            throw new Error(`forwarder ${this.name} chat_id is required`)
        }
        this.chat_id = chat_id
        this.bot = new Telegraf(token)
    }
    public async send(
        text: string,
        media?: Array<{
            source: string
            type: string
            media_type: string
            path: string
        }>,
    ) {
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
