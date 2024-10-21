import { CookieParam } from 'puppeteer'
import fs from 'fs'
/**
 * @description convert netscape cookie file to puppeteer cookie like https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?hl=en
 * @param cookie_file path to cookie file
 * @returns CookieParam[]
 */
function parseNetscapeCookieToPuppeteerCookie(cookie_file: string): Array<CookieParam> {
    let lines = fs.readFileSync(cookie_file, 'utf8').split('\n')
    const cookies = []
    for (const line of lines) {
        if (line.startsWith('#') || line === '') {
            continue
        }
        let fileds = line.split('\t')
        let domain = fileds[0],
            includeSubdomain = fileds[1],
            path = fileds[2],
            secure = fileds[3],
            expires = fileds[4],
            name = fileds[5],
            value = fileds[6]
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

export { parseNetscapeCookieToPuppeteerCookie }
