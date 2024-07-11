import { ForwardPlatformEnum, IForwardTo, IWebsite, IWebsiteConfig } from '@/types/bot'
import { CronJob } from 'cron'
import { fwd_app } from '@/config'
import { Browser, Page } from 'puppeteer'
import fs from 'fs'
import { X } from '@idol-bbq-utils/spider'
import { ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { log } from '../config'
import { XCollector } from '@/middleware/collector/x'
import { BaseCollector } from '@/middleware/collector/base'
import { TgForwarder } from '@/middleware/forwarder/telegram'
import { BaseForwarder } from '@/middleware/forwarder/base'
import { BiliForwarder } from '@/middleware/forwarder/bilibili'
import { orderBy, shuffle, sortBy } from 'lodash'

async function delay(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}
export class FWDBot {
    public name: string
    private websites: Array<IWebsite>
    private config: IWebsiteConfig
    private collector: BaseCollector<ITweetArticle>
    private forwarders: Array<BaseForwarder> = []
    private jobs: Map<string, CronJob>
    constructor(name: string, websites: Array<IWebsite>, forward_to: Array<IForwardTo>, config: IWebsiteConfig = {}) {
        this.name = name
        this.websites = websites
        this.config = {
            ...fwd_app.config,
            ...config,
        }
        for (const forward of forward_to) {
            if (forward.type === ForwardPlatformEnum.Telegram) {
                this.forwarders.push(new TgForwarder(forward.token, forward.chat_id ?? ''))
            }
            if (forward.type === ForwardPlatformEnum.Bilibili) {
                this.forwarders.push(new BiliForwarder(forward.token))
            }
        }
        this.jobs = new Map()
        this.collector = new XCollector()
    }

    public async init(browser: Browser) {
        log.info(`[${this.name}] init`)
        for (const website of this.websites) {
            const page = await browser.newPage()
            const cookie = website.cookie_file && fs.readFileSync(website.cookie_file, 'utf8')
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
            website.config = {
                ...this.config,
                ...website.config,
            }
            // do cron here
            const job = CronJob.from({
                cronTime: website.config?.cron || '* * * * *',
                onTick: async () => {
                    if (website.config?.interval_time) {
                        const time = Math.floor(
                            Math.random() * (website.config.interval_time.max - website.config.interval_time.min) +
                                website.config.interval_time.min,
                        )
                        log.info(`[${this.name}] cron triggered but wait for ${time}ms`)
                        await delay(time)
                    }
                    log.info(`[${this.name}] start job for ${website.domain}`)
                    // for now x only
                    const _paths = shuffle(website.paths)
                    for (const path of _paths) {
                        log.info(`[${this.name}] grab tweets for ${website.domain}/${path}`)
                        try {
                            const res = await X.TweetGrabber.Article.grabTweets(page, `${website.domain}/${path}`)
                            this.collector.collect(orderBy(res, ['timestamp'], 'asc'), 'tweet').then((ids) => {
                                this.collector.forward(ids, this.forwarders)
                            })
                        } catch (e) {
                            log.error(`[${this.name}] grab tweets failed for ${website.domain}/${path}: ${e}`)
                        }

                        if (website.config?.interval_time) {
                            const time = Math.floor(
                                Math.random() * (website.config.interval_time.max - website.config.interval_time.min) +
                                    website.config.interval_time.min,
                            )
                            log.info(`[${this.name}] wait for next loop ${time}ms`)
                            await delay(time)
                        }
                    }
                    log.info(`[${this.name}] job done for ${website.domain}`)
                    // saving and notify bot
                },
            })
            this.jobs.set(website.domain, job)
        }
        return this
    }

    public start() {
        this.jobs.forEach((job) => job.start())
    }
}
