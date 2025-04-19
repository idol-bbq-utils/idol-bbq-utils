import { Platform } from '@/types'
import type { GenericMediaInfo, GenericArticle, GenericFollows, TaskType, TaskTypeResult } from '@/types'
import { BaseSpider, waitForResponse } from './base'
import { Page } from 'puppeteer-core'

import { JSONPath } from 'jsonpath-plus'
import { defaultViewport } from './base'
import { getCookieString, HTTPClient } from '@/utils'
import dayjs, { type ManipulateType } from 'dayjs'

enum ArticleTypeEnum {
    /**
     * https://www.youtube.com/@username/community
     */
    POST = 'post',
    /**
     * https://www.youtube.com/@username/shorts
     */
    // SHORTS = 'shorts',
}

class YoutubeSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = /(https:\/\/)?(www\.)?youtube\.com\/@(?<id>\w+)/
    static _PLATFORM = Platform.YouTube
    BASE_URL: string = 'https://www.youtube.com/'
    NAME: string = 'Youtube Generic Spider'

    async _crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type: T = 'article' as T,
    ): Promise<TaskTypeResult<T, Platform.YouTube>> {
        const result = super._match_valid_url(url, YoutubeSpider)?.groups
        if (!result) {
            throw new Error(`Invalid URL: ${url}`)
        }
        const { id } = result
        const _url = `${this.BASE_URL}@${id}`
        if (task_type === 'article') {
            this.log?.info('Trying to grab posts.')
            const res = await YoutubeApiJsonParser.grabPosts(page, `${_url}/community`)

            return res as TaskTypeResult<T, Platform.YouTube>
        }

        throw new Error('Invalid task type')
    }
}

namespace YoutubeApiJsonParser {
    function mediaParser(item: any): GenericMediaInfo {
        return {
            type: 'photo',
            url: item.backstageImageRenderer.image.thumbnails.sort((a: any, b: any) => b.width - a.width)[0].url,
        }
    }
    function postMediaParser(item: any): Array<GenericMediaInfo> | null {
        if (item.backstageImageRenderer) {
            return [mediaParser(item)]
        }
        if (item.postMultiImageRenderer) {
            return item.postMultiImageRenderer.images.map(postMediaParser)
        }
        return null
    }

    /**
     *
     * @param relativeTime like "1 hour ago", "2 days ago"
     * @description parse relative time to timestamp
     * @returns timestamp
     */
    function relativeTimeParser(relativeTime: string): number {
        const [number, unit, _] = relativeTime.split(' ')
        return dayjs()
            .subtract(parseInt(number || '0'), unit as ManipulateType)
            .unix()
    }

    function postParser(item: any): GenericArticle<Platform.YouTube> | null {
        if (!item) {
            return null
        }
        const author = item.authorText.runs[0]
        return {
            platform: Platform.YouTube,
            a_id: item.postId,
            u_id: author?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl.slice(2),
            username: author?.text,
            created_at: relativeTimeParser(item.publishedTimeText.runs[0]?.text),
            content: item?.contentText.runs.map((i: any) => i.text).join(''),
            url: `https://youtube.com${item.publishedTimeText.runs[0]?.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
            type: ArticleTypeEnum.POST,
            ref: null,
            has_media: Boolean(item.backstageAttachment),
            media: item.backstageAttachment ? postMediaParser(item.backstageAttachment) : null,
            extra: null,
            u_avatar: `https:${item?.authorThumbnail.thumbnails.sort((a: any, b: any) => b.width - a.width)[0].url}`,
        }
    }

    export function postsParser(items: any): Array<GenericArticle<Platform.YouTube>> {
        if (!items) {
            throw new Error('Posts format may have changed')
        }
        return items
            .map((i: any) => postParser(i.backstagePostThreadRenderer?.post.backstagePostRenderer))
            .filter(Boolean)
    }

    // export function followsParser(json: any): GenericFollows {
    //     if (!json) {
    //         throw new Error('Profile format may have changed')
    //     }
    //     let user = json?.data?.user
    //     return {
    //         platform: Platform.Instagram,
    //         username: user?.full_name,
    //         u_id: user?.username,
    //         followers: user?.follower_count,
    //     }
    // }

    /**
     * @param url https://www.youtube.com/@username
     * @description grab common posts from html
     */
    export async function grabPosts(page: Page, url: string): Promise<Array<GenericArticle<Platform.YouTube>>> {
        const cookies = await page.browserContext().cookies()
        /**
         * Use api query instead of headless browser
         */
        const webpage = await HTTPClient.download_webpage(url, {
            'accept-language': 'en-US,en;q=0.9',
            cookie: getCookieString(cookies),
        })
        const text = await webpage.text()
        const json = text.match(/ytInitialData = (.*?);<\/script>/)?.[1]
        if (!json) {
            throw new Error('Cannot find user data')
        }
        const items = JSONPath({
            path: '$..itemSectionRenderer.contents',
            json: JSON.parse(json),
        })[0]
        return postsParser(items)
    }

    // export async function grabShorts(page: Page, url: string): Promise<Array<GenericArticle<Platform.YouTube>>> {

    // }

    // export async function grabFollowsNumber(
    //     url: string,
    //     random_hex7: string,
    //     device_id: number,
    // ): Promise<GenericFollows> {
    //     const webpage = await HTTPClient.download_webpage(url)
    //     const text = await webpage.text()
    //     const content = text.match(/<script\s*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
    //     if (!content) {
    //         throw new Error('Cannot find user data')
    //     }
    //     const userInfo = JSONPath({
    //         path: "$..['webapp.user-detail'].userInfo",
    //         json: JSON.parse(content),
    //         resultType: 'value',
    //     })[0]
    //     return {
    //         followers: userInfo?.stats?.followerCount,
    //         platform: Platform.TikTok,
    //         username: userInfo?.user?.nickname,
    //         u_id: userInfo?.user?.uniqueId,
    //     }
    // }
}

export { ArticleTypeEnum, YoutubeApiJsonParser }
export { YoutubeSpider }
