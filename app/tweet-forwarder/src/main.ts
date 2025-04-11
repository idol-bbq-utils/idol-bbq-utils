import puppeteer from 'puppeteer-core'
import { SpiderPools, SpiderTaskScheduler } from './managers/spider-manager'
import { configParser, log } from './config'
import EventEmitter from 'events'
import { ForwarderPools, ForwarderTaskScheduler } from './managers/forwarder-manager'
import { BaseCompatibleModel, TaskScheduler } from './utils/base'

async function main() {
    const taskSchedulers: Array<TaskScheduler.TaskScheduler> = []
    const compatibleModels: Array<BaseCompatibleModel> = []
    const emitter = new EventEmitter()

    const config = configParser('./config.yaml')
    if (!config) {
        log.error('Config file is empty or invalid, exiting...')
        return
    }
    const { crawlers, cfg_crawler, forward_targets, cfg_forward_target, forwarders, cfg_forwarder } = config

    if (crawlers && crawlers.length > 0) {
        const browser = await puppeteer.launch({
            headless: true,
            handleSIGINT: false,
            handleSIGHUP: false,
            handleSIGTERM: false,
            args: [process.env.NO_SANDBOX ? '--no-sandbox' : ''],
            channel: 'chrome',
        })
        // @ts-ignore
        const spiderPools = new SpiderPools(browser, emitter, log)
        compatibleModels.push(spiderPools)
        const spiderTaskScheduler = new SpiderTaskScheduler(
            {
                crawlers,
                cfg_crawler,
            },
            emitter,
            log,
        )
        taskSchedulers.push(spiderTaskScheduler)
    }

    if (forward_targets && forward_targets.length > 0) {
        const forwarderPools = new ForwarderPools(
            {
                forward_targets,
                cfg_forward_target,
            },
            emitter,
            log,
        )
        compatibleModels.push(forwarderPools)
    }

    if (forwarders && forwarders.length > 0) {
        const forwarderTaskScheduler = new ForwarderTaskScheduler(
            {
                forwarders,
                cfg_forwarder,
            },
            emitter,
            log,
        )
        taskSchedulers.push(forwarderTaskScheduler)
    }

    for (const c of compatibleModels) {
        await c.init()
    }

    for (const taskScheduler of taskSchedulers) {
        await taskScheduler.init()
        await taskScheduler.start()
    }

    async function exitHandler() {
        for (const taskScheduler of taskSchedulers) {
            await taskScheduler.stop()
            await taskScheduler.drop()
        }
        for (const c of compatibleModels) {
            await c.drop()
        }
        process.exit(0)
    }
    process.on('SIGINT', exitHandler)
    process.on('SIGTERM', exitHandler)
    process.on('SIGHUP', exitHandler)
}
main()
