import puppeteer from 'puppeteer'

import { fwd_app } from './config'
import { FWDBot } from './bot'

async function main() {
    const browser = await puppeteer.launch({ headless: true })
    const bots = fwd_app.bots.map((_b) => new FWDBot(_b.name, _b.websites, _b.forward_to, _b.configs))

    for (const bot of bots) {
        const _b = await bot.init(browser)
        _b.start()
    }
}
main()
