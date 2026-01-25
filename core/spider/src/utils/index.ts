import type { CookieData } from 'puppeteer-core'
import fs from 'fs'

// cookie_string is high priority than cookie_file
function resolveCookieString(cookie_string?: string, cookie_file?: string): string {
    if (cookie_string) {
        return cookie_string
    } else if (cookie_file) {
        try {
            return fs.readFileSync(cookie_file, 'utf-8')
        } catch (err) {
            throw new Error(`Failed to read cookie file: ${err}`)
        }
    } else {
        return ''
    }
}
/**
 * @description convert netscape cookie file to puppeteer cookie like https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?hl=en
 * @param cookie_string cookie string in netscape format
 * @returns CookieParam[]
 */
function parseNetscapeCookieToPuppeteerCookie(cookie_string?: string, cookie_file?: string): Array<CookieData> {
    let lines = resolveCookieString(cookie_string, cookie_file).split('\n')
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

class SimpleExpiringCache {
    cache: Map<string, any>
    constructor() {
        this.cache = new Map()
    }

    /**
     * @param ttl seconds
     */
    set(key: string, value: any, ttl: number) {
        const expiresAt = Date.now() + ttl * 1000
        this.cache.set(key, { value, expiresAt })

        setTimeout(() => {
            if (this.cache.get(key)?.expiresAt <= Date.now()) {
                this.cache.delete(key)
            }
        }, ttl)
    }

    get(key: string) {
        const item = this.cache.get(key)
        if (!item) return null

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key)
            return null
        }

        return item.value
    }
}

export { parseNetscapeCookieToPuppeteerCookie, getCookieString, SimpleExpiringCache }
export * from './http'
