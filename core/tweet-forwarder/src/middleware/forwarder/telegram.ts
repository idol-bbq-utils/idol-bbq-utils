import { Telegraf } from 'telegraf'
import { BaseForwarder } from './base'

class TgForwarder extends BaseForwarder {
    private chat_id: string
    private bot: Telegraf
    constructor(token: string, chat_id: string) {
        super(token)
        this.chat_id = chat_id
        this.bot = new Telegraf(token)
    }
    public async send(text: string) {
        await this.bot.telegram.sendMessage(this.chat_id, text)
        return
    }
}

export { TgForwarder }
