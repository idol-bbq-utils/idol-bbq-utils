import type { CookieData } from 'puppeteer-core'
import fs from 'fs'

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
            value = fileds[6]?.trim() || ''
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

function getCookieString(cookies: Array<CookieData>): string {
    return cookies
        .map((cookie) => {
            return `${cookie.name}=${cookie.value}`.trim()
        })
        .join(';')
}

export { parseNetscapeCookieToPuppeteerCookie, getCookieString }
export * from './http'
