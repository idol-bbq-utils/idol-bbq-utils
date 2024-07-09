import { X } from '@idol-bbq-utils/spider'
import puppeteer, { CookieParam } from 'puppeteer'
import { createLogger } from '@idol-bbq-utils/log'
import fs from 'fs'
import YAML from 'yaml'
import { IYamlConfig } from './types/config'

const log = createLogger({
  defaultMeta: { service: 'tweet-forwarder' },
})

async function main() {
  // Launch the browser and open a new blank page
  const yaml = fs.readFileSync('./config.yaml', 'utf8')
  const config = YAML.parse(yaml) as IYamlConfig
  const bot = config.bots[0]
  const x = bot['websites'][0]
  const _c = x['cookie_file'] && fs.readFileSync(x['cookie_file'], 'utf8')
  const cookies = JSON.parse(_c ?? '')

  const browser = await puppeteer.launch({ headless: true })

  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  )
  // await page.setCookie(...cookies)
  const tweets = await X.TweetGrabber.Article.grabTweets(page, `${x['domain']}/${x['paths'][0]}`)
  log.info(tweets)
  await page.close()
  await browser.close()
}
main()
