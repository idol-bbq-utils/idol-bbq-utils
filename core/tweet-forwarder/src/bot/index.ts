import { IForwardTo, IWebsite, IWebsiteConfig } from '@/types/bot'
import { CronJob } from 'cron'
import { fwd_app } from '@/config'
import { Browser, Page } from 'puppeteer'
import fs from 'fs'
import { X } from '@idol-bbq-utils/spider'
import { ITweetArticle } from '@idol-bbq-utils/spider/lib/websites/x/types/types'
import { log } from '../config'
import { XCollector } from '@/collector/x'

export class FWDBot {
    public name: string
    private websites: Array<IWebsite>
    private forward_to: Array<IForwardTo>
    private config: IWebsiteConfig
    private collector: XCollector

    private jobs: Map<string, CronJob>
    constructor(name: string, websites: Array<IWebsite>, forward_to: Array<IForwardTo>, config: IWebsiteConfig = {}) {
        this.name = name
        this.websites = websites
        this.forward_to = forward_to
        this.config = {
            ...fwd_app.config,
            ...config,
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
            // do cron here
            const job = CronJob.from({
                cronTime: website.config?.cron || this.config.cron || '* * * * *',
                onTick: async () => {
                    // for now x only
                    let tweets = [] as ITweetArticle[]
                    for (const path of website.paths) {
                        const res = await X.TweetGrabber.Article.grabTweets(page, `${website.domain}/${path}`)
                        tweets = tweets.concat(res)
                    }
                    this.collector.collect(tweets, 'tweet').then((c) => {})
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
