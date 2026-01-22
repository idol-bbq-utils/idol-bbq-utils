import { Platform } from '@/types'
import type { GenericMediaInfo, GenericArticle, GenericFollows, TaskType, TaskTypeResult, CrawlEngine } from '@/types'
import { BaseSpider } from './base'
import { Page } from 'puppeteer-core'

import { JSONPath } from 'jsonpath-plus'
import { HTTPClient, SimpleExpiringCache } from '@/utils'

enum ArticleTypeEnum {
    /**
     * basic page: https://www.tiktok.com/api/post/item_list/
     */
    POST = 'post',
}

class TiktokSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = /(https:\/\/)?(www\.)?tiktok\.com\/@(?<id>\w+)/
    static _PLATFORM = Platform.TikTok
    BASE_URL: string = 'https://www.tiktok.com/'
    NAME: string = 'Tiktok Generic Spider'

    private cache: SimpleExpiringCache = new SimpleExpiringCache()
    private expire: number = 60 * 3 * 1000 // 3 minutes

    async _crawl<T extends TaskType>(
        url: string,
        page: Page | undefined,
        config: {
            task_type: T
            crawl_engine: CrawlEngine
            sub_task_type?: Array<string>
            cookieString?: string
        },
    ): Promise<TaskTypeResult<T, Platform.TikTok>> {
        const result = super._match_valid_url(url, TiktokSpider)?.groups
        if (!result) {
            throw new Error(`Invalid URL: ${url}`)
        }
        let random_hex7 = this.cache.get('random_hex7')
        if (!random_hex7) {
            random_hex7 = TiktokApiJsonParser.randomHexString(7)
            this.cache.set('random_hex7', random_hex7, this.expire)
        }
        let device_id = this.cache.get('device_id')
        if (!device_id) {
            device_id = TiktokApiJsonParser.randomDeviceId().toString()
            this.cache.set('device_id', device_id, this.expire)
        }
        const { id } = result
        const _url = `${this.BASE_URL}@${id}`
        const { task_type } = config
        if (task_type === 'article') {
            this.log?.info('Trying to grab posts.')
            const res = await TiktokApiJsonParser.grabPosts(_url, random_hex7, Number(device_id))
            return res as TaskTypeResult<T, Platform.TikTok>
        }

        if (task_type === 'follows') {
            this.log?.info('Trying to grab follows.')
            return [
                await TiktokApiJsonParser.grabFollowsNumber(_url, random_hex7, Number(device_id)),
            ] as TaskTypeResult<T, Platform.TikTok>
        }

        throw new Error('Invalid task type')
    }
}

namespace TiktokApiJsonParser {
    const BelowRange = 7250000000000000000
    const AboveRange = 7351147085025500000
    const _API_BASE_URL = 'https://www.tiktok.com/api/creator/item_list/'

    const hex_digits = '0123456789abcdefABCDEF'

    export function randomHexString(length: number): string {
        return Array.from({ length }, () => hex_digits[Math.floor(Math.random() * hex_digits.length)]).join('')
    }

    export function randomDeviceId(): number {
        return Math.floor(Math.random() * (AboveRange - BelowRange + 1) + BelowRange)
    }

    async function checkLogin(page: Page) {
        const login_form = await page.waitForSelector('form[id="loginForm"]', { timeout: 1000 }).catch(() => null)
        if (login_form) {
            throw new Error('You need to login first, check your cookies')
        }
    }

    async function checkSomethingWrong(page: Page) {
        const main_frame_error = await page
            .waitForSelector('div[id="main-frame-error"]', { timeout: 1000 })
            .catch(() => null)
        if (main_frame_error) {
            const error_content = (await main_frame_error.evaluate((e) => e.textContent))?.replace(/\s+/g, ' ')
            throw new Error(`Something wrong on the page: ${error_content}`)
        }
    }

    function mediaParser(item: any): Array<GenericMediaInfo> {
        const video = item?.video
        if (!video) {
            return []
        }

        let arr = [] as Array<GenericMediaInfo>
        // cover
        arr.push({
            type: 'video_thumbnail',
            url: video.cover,
        })
        arr.push({
            type: 'video_thumbnail',
            url: video.originCover,
        })
        // video
        let urlList = video.bitrateInfo.sort((a: any, b: any) => b.Bitrate - a.Bitrate)[0]?.PlayAddr?.UrlList
        if (urlList) {
            arr.push({
                type: 'video',
                url: urlList.find((m: any) => m.includes('aweme/v1/play')) || urlList.pop(),
            })
        }
        return Array.from(new Set(arr)).map((m) => {
            return {
                ...m,
                url: m.url.replace('\\u0026', '&'),
            }
        })
    }

    function postParser(item: any): GenericArticle<Platform.TikTok> {
        const author = item?.author
        return {
            platform: Platform.TikTok,
            a_id: item?.id,
            u_id: author?.uniqueId,
            username: author?.nickname,
            created_at: item?.createTime,
            content: item?.desc,
            url: `https://www.tiktok.com/@${author?.uniqueId}/video/${item?.id}/`,
            type: ArticleTypeEnum.POST,
            ref: null,
            has_media: true,
            media: mediaParser(item),
            extra: null,
            u_avatar: author?.avatarLarger.replace('\\u0026', '&'),
        }
    }

    export function postsParser(json: any): Array<GenericArticle<Platform.TikTok>> {
        let items = json?.itemList
        if (!items) {
            return []
        }
        return items.map(postParser)
    }

    export function followsParser(json: any): GenericFollows {
        if (!json) {
            throw new Error('Profile format may have changed')
        }
        let user = json?.data?.user
        return {
            platform: Platform.Instagram,
            username: user?.full_name,
            u_id: user?.username,
            followers: user?.follower_count,
        }
    }

    /**
     *  // ref: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/tiktok.py
     */
    function _build_web_query(sec_uid: string, cursor: number, device_id: number, random7: string) {
        return {
            aid: '1988',
            app_language: 'en',
            app_name: 'tiktok_web',
            browser_language: 'en-US',
            browser_name: 'Mozilla',
            browser_online: 'true',
            browser_platform: 'Win32',
            browser_version: '5.0 (Windows)',
            channel: 'tiktok_web',
            cookie_enabled: 'true',
            count: '15',
            cursor: cursor,
            device_id: device_id,
            device_platform: 'web_pc',
            focus_state: 'true',
            from_page: 'user',
            history_len: '2',
            is_fullscreen: 'false',
            is_page_visible: 'true',
            language: 'en',
            os: 'windows',
            priority_region: '',
            referer: '',
            region: 'US',
            screen_height: '1080',
            screen_width: '1920',
            secUid: sec_uid,
            type: '1',
            tz_name: 'UTC',
            verifyFp: `verify_${random7}`,
            webcast_language: 'en',
        }
    }

    /**
     * @param url https://www.tiktok.com/@username
     * @description grab common posts from api
     */
    export async function grabPosts(
        url: string,
        random_hex7: string,
        device_id: number,
    ): Promise<Array<GenericArticle<Platform.TikTok>>> {
        // const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
        //     const url = response.url()
        //     const request = response.request()
        //     if (url.includes('/api/post/item_list') && request.method() === 'GET') {
        //         if (response.status() >= 400) {
        //             fail(new Error(`Error: ${response.status()}`))
        //             return
        //         }
        //         // will get empty response from api
        //         response
        //             .json()
        //             .then((json) => {
        //                 done(json)
        //             })
        //             .catch((error) => {
        //                 fail(error)
        //             })
        //     }
        // })
        // await page.setViewport(config.viewport ?? defaultViewport)
        // await page.goto(url)
        // try {
        //     // await checkLogin(page)
        //     // await checkSomethingWrong(page)
        // } catch (error) {
        //     cleanup()
        //     throw error
        // }
        // return postsParser(posts_json)
        /**
         * Use api query instead of headless browser
         */
        // ref: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/tiktok.py
        const webpage = await HTTPClient.download_webpage(url)
        const text = await webpage.text()
        const content = text.match(/<script\s*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
        if (!content) {
            throw new Error('Cannot find user data')
        }
        const sec_uid = JSONPath({
            path: "$..['webapp.user-detail'].userInfo.user.secUid",
            json: JSON.parse(content),
            resultType: 'value',
        })
        const query_obj = _build_web_query(sec_uid[0], Date.now(), device_id, random_hex7)
        // @ts-ignore
        const query = new URLSearchParams(query_obj)
        const res = await HTTPClient.download_webpage(`${_API_BASE_URL}?${query.toString()}`)
        const json = await res.json()
        return postsParser(json)
    }

    export async function grabFollowsNumber(
        url: string,
        random_hex7: string,
        device_id: number,
    ): Promise<GenericFollows> {
        const webpage = await HTTPClient.download_webpage(url)
        const text = await webpage.text()
        const content = text.match(/<script\s*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
        if (!content) {
            throw new Error('Cannot find user data')
        }
        const userInfo = JSONPath({
            path: "$..['webapp.user-detail'].userInfo",
            json: JSON.parse(content),
            resultType: 'value',
        })[0]
        return {
            followers: userInfo?.stats?.followerCount,
            platform: Platform.TikTok,
            username: userInfo?.user?.nickname,
            u_id: userInfo?.user?.uniqueId,
        }
    }
}

export { ArticleTypeEnum, TiktokApiJsonParser }
export { TiktokSpider }
