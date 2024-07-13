import { ForwardPlatformEnum, IForwardTo, IWebsite, IWebsiteConfig } from '@/types/bot'
import { CronJob } from 'cron'
import { fwd_app } from '@/config'
import { Browser } from 'puppeteer'
import fs from 'fs'
import { X } from '@idol-bbq-utils/spider'
import { ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { log } from '../config'
import { XCollector } from '@/middleware/collector/x'
import { Collector } from '@/middleware/collector/base'
import { TgForwarder } from '@/middleware/forwarder/telegram'
import { BaseForwarder } from '@/middleware/forwarder/base'
import { BiliForwarder } from '@/middleware/forwarder/bilibili'
import { orderBy, shuffle } from 'lodash'
import { collectorFetcher } from '@/middleware/collector'
import { delay } from '@/utils/time'
import { Gemini } from '@/middleware/translator/gemini'

export class FWDBot {
    public name: string
    private websites: Array<IWebsite>
    private config: IWebsiteConfig

    private forwarders: Array<BaseForwarder> = []
    private collectors: Map<string, Collector> = new Map()

    private jobs: Array<CronJob>
    constructor(name: string, websites: Array<IWebsite>, forward_to: Array<IForwardTo>, config: IWebsiteConfig = {}) {
        this.name = name
        this.websites = websites
        this.config = {
            ...fwd_app.config,
            ...config,
        }
        for (const forward of forward_to ?? []) {
            if (forward.type === ForwardPlatformEnum.Telegram) {
                this.forwarders.push(new TgForwarder(forward.token, forward.chat_id ?? ''))
            }
            if (forward.type === ForwardPlatformEnum.Bilibili) {
                this.forwarders.push(new BiliForwarder(forward.token))
            }
        }
        for (const website of this.websites) {
            const url = new URL(website.domain)
            const CollectorBuilder = collectorFetcher(website.domain)
            this.collectors.set(url.hostname, new CollectorBuilder())
        }

        this.jobs = []
        this.collectors
    }

    public async init(browser: Browser) {
        log.info(`[${this.name}] init`)
        for (const website of this.websites) {
            const cookie = website.cookie_file && fs.readFileSync(website.cookie_file, 'utf8')
            const url = new URL(website.domain)
            const collector = this.collectors.get(url.hostname)
            website.config = {
                ...this.config,
                ...website.config,
            }
            const translator = website.config?.translator && new Gemini(website.config.translator.key)
            await translator?.init()
            // do cron here
            const job = CronJob.from({
                cronTime: website.config?.cron || '* * * * *',
                onTick: async () => {
                    log.info(`[${this.name}] start job for ${website.domain}`)
                    const page = await browser.newPage()
                    if (cookie) {
                        log.info(`[${this.name}] set cookie for ${website.domain}`)
                        const cookies = JSON.parse(cookie)
                        await page.setCookie(...cookies)
                    }
                    await page.setUserAgent(
                        website.config?.user_agent ||
                            this.config.user_agent ||
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
                    )
                    if (website.config?.interval_time) {
                        const time = Math.floor(
                            Math.random() * (website.config.interval_time.max - website.config.interval_time.min) +
                                website.config.interval_time.min,
                        )
                        log.info(`[${this.name}] cron triggered but wait for ${time}ms`)
                        await delay(time)
                    }

                    await collector?.collectAndForward(page, website.domain, website.paths, this.forwarders, {
                        type: website.task_type,
                        title: website.task_title,
                        interval_time: website.config?.interval_time,
                        translator,
                    })
                    await page.close()
                    log.info(`[${this.name}] job done for ${website.domain}`)
                    // saving and notify bot
                },
            })
            log.info(`[${this.name}] job created for ${website.domain}, with type ${website.task_type || 'default'}`)
            this.jobs.push(job)
        }
        return this
    }

    public start() {
        this.jobs.forEach((job) => job.start())
    }
}
