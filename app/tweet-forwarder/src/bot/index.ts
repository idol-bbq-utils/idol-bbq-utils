import { ForwardPlatformEnum, IBotConfig, IForwardTo, IWebsite } from '@/types/bot'
import { CronJob } from 'cron'
import { Browser } from 'puppeteer-core'
import { log } from '../config'
import { Collector } from '@/middleware/collector/base'
import { TgForwarder } from '@/middleware/forwarder/telegram'
import { BaseForwarder } from '@/middleware/forwarder/base'
import { BiliForwarder } from '@/middleware/forwarder/bilibili'
import { collectorFetcher } from '@/middleware/collector'
import { delay } from '@/utils/time'
import { Gemini } from '@/middleware/translator/gemini'
import { pRetry } from '@idol-bbq-utils/utils'
import { parseNetscapeCookieToPuppeteerCookie } from '@/utils/auth'
import { BaseTranslator } from '@/middleware/translator/base'
import { QQForwarder } from '@/middleware/forwarder/qq'
import { BigModelGLM4Flash } from '@/middleware/translator/bigmodel'
import { Doubao128KPro } from '@/middleware/translator/doubao'
import { DeepSeekV3 } from '@/middleware/translator/deepseek'

export class FWDBot {
    public name: string
    private websites: Array<IWebsite>
    private config: IBotConfig

    private forwarders: Array<BaseForwarder> = []
    private collectors: Map<string, Collector> = new Map()

    private jobs: Array<CronJob>
    constructor(name: string, websites: Array<IWebsite>, forward_to: Array<IForwardTo>, config: IBotConfig = {}) {
        this.name = name
        this.websites = websites
        this.config = config
        for (const forward of forward_to ?? []) {
            forward.config = {
                ...this.config.cfg_forward_to,
                ...forward.config,
            }
            if (forward.type === ForwardPlatformEnum.Telegram) {
                this.forwarders.push(new TgForwarder(forward.chat_id ?? '', forward.token, forward.config || {}))
            }
            if (forward.type === ForwardPlatformEnum.Bilibili) {
                this.forwarders.push(new BiliForwarder(forward.bili_jct ?? '', forward.token, forward.config || {}))
            }
            if (forward.type === ForwardPlatformEnum.QQ) {
                this.forwarders.push(
                    new QQForwarder(forward.group_id ?? '', forward.url ?? '', forward.token, forward.config || {}),
                )
            }
        }
        for (const website of this.websites) {
            const url = new URL(website.domain)
            const CollectorBuilder = collectorFetcher(website.domain)
            this.collectors.set(url.hostname, new CollectorBuilder(this.name))
        }

        this.jobs = []
        this.collectors
    }

    public async init(browser: Browser) {
        log.info(`[${this.name}] init`)
        for (const website of this.websites) {
            const cookies = website.cookie_file && parseNetscapeCookieToPuppeteerCookie(website.cookie_file)
            const url = new URL(website.domain)
            const collector = this.collectors.get(url.hostname)
            website.config = {
                ...this.config.cfg_websites,
                ...website.config,
            }
            log.debug(website.config)
            let translator: BaseTranslator | undefined
            if (website.config?.translator) {
                const _translator = website.config.translator
                if (_translator.type === 'gemini') {
                    translator = new Gemini(_translator.key, _translator.prompt)
                }
                if (_translator.type === 'glm-4-flash') {
                    translator = new BigModelGLM4Flash(_translator.key, _translator.prompt)
                }
                if (_translator.type === 'doubao-pro-128k') {
                    translator = new Doubao128KPro(_translator.key, _translator.model_id || '', _translator.prompt)
                }
                if (_translator.type === 'deepseek-v3') {
                    translator = new DeepSeekV3(_translator.key, _translator.model_id || '', _translator.prompt)
                }
            }
            await translator?.init()
            // do cron here
            const job = CronJob.from({
                cronTime: website.config?.cron || '* * * * *',
                onTick: async () => {
                    const task_id = Math.random().toString(36).substring(7)
                    log.info(`[${task_id}] [${this.name}] start job for ${website.domain}`)
                    const page = await pRetry(() => browser.newPage(), {
                        retries: 2,
                        onFailedAttempt(error) {
                            log.error(`[${task_id}] failed to create page, retrying... ${error.message}`)
                        },
                    })
                    if (cookies) {
                        log.info(`[${task_id}] [${this.name}] set cookie for ${website.domain}`)
                        await page.setCookie(...cookies)
                    }
                    !!website.config?.puppeteer?.timeout &&
                        (await page.setDefaultTimeout(website.config.puppeteer.timeout))
                    await page.setUserAgent(
                        website.config?.user_agent ||
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
                    )
                    if (website.config?.interval_time) {
                        const time = Math.floor(
                            Math.random() * (website.config.interval_time.max - website.config.interval_time.min) +
                                website.config.interval_time.min,
                        )
                        log.info(`[${task_id}] [${this.name}] cron triggered but wait for ${time}ms`)
                        await delay(time)
                    }

                    await collector?.collectAndForward(page, website.domain, website.paths, this.forwarders, {
                        type: website.task_type,
                        title: website.task_title,
                        interval_time: website.config?.interval_time,
                        translator,
                        task_id,
                        media: website.config?.media,
                    })
                    await page.close()
                    log.info(`[${task_id}] [${this.name}] job done for ${website.domain}`)
                    // saving and notify bot
                },
            })
            log.info(`[${this.name}] job created for ${website.domain}, with type ${website.task_type || 'default'}`)
            this.jobs.push(job)
        }
        return this
    }
    public stop() {
        this.jobs.forEach((job) => job.stop())
    }

    public start() {
        this.jobs.forEach((job) => job.start())
    }
}
