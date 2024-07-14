import { Telegraf } from 'telegraf'
import { BaseForwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'

class TgForwarder extends BaseForwarder {
    private chat_id: string
    private bot: Telegraf
    constructor(token: string, chat_id: string) {
        super(token)
        this.chat_id = chat_id
        this.bot = new Telegraf(token)
    }
    public async send(text: string) {
        await pRetry(() => this.bot.telegram.sendMessage(this.chat_id, text), {
            retries: 3,
            onFailedAttempt(error) {
                log.error(`Send text to telegram failed. There are ${error.retriesLeft} retries left. ${error.message}`)
            },
        })
        return
    }
}

export { TgForwarder }
