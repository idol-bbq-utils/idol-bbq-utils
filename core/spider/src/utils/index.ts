import type { CookieData } from 'puppeteer-core'
import fs from 'fs'

const UserAgent = {
    CHROME: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    FIREFOX: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
    SAFARI: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
}

/**
 * @description convert netscape cookie file to puppeteer cookie like https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?hl=en
 * @param cookie_file path to cookie file
 * @returns CookieParam[]
 */
function parseNetscapeCookieToPuppeteerCookie(cookie_file: string): Array<CookieData> {
    let lines = fs.readFileSync(cookie_file, 'utf8').split('\n')
    const cookies = []
    for (let line of lines) {
        //  ref: https://github.com/Moustachauve/cookie-editor
        if (line.startsWith('#HttpOnly_')) {
            line = line.replace('#HttpOnly_', '')
        }
        if (line.startsWith('#') || line === '') {
            continue
        }
        let fileds = line.split(new RegExp('[\t ]+'))
        let domain = fileds[0] || '',
            includeSubdomain = fileds[1],
            path = fileds[2],
            secure = fileds[3],
            expires = fileds[4],
            name = fileds[5] || '',
            value = fileds[6] || ''
        cookies.push({
            name,
            value,
            domain,
            path,
            expires: Number(expires),
            httpOnly: false,
            secure: secure === 'TRUE',
        })
    }
    return cookies
}

export { parseNetscapeCookieToPuppeteerCookie, UserAgent }
