import { GenericArticle, GenericFollows, GenericMediaInfo, Platform, TaskType, TaskTypeResult } from '@/types'
import { BaseSpider, waitForResponse } from './base'
import { Page } from 'puppeteer-core'

import { JSONPath } from 'jsonpath-plus'

enum ArticleTypeEnum {
    /**
     * basic page
     */
    POST = 'post',
    /**
     * as known as highlights
     */
    STORIES = 'stories',
    /**
     * TODO
     *
     * reels page
     */
    REEL = 'reel',
}

class InstagramSpider extends BaseSpider {
    // extends from XBaseSpider regex
    static _VALID_URL = /(https:\/\/)?(www\.)?instagram\.com\/(?<id>\w+)/
    static _PLATFORM = Platform.Instagram
    BASE_URL: string = 'https://www.instagram.com/'
    NAME: string = 'Instagram Generic Spider'

    async _crawl<T extends TaskType>(
        url: string,
        page: Page,
        task_type: T = 'article' as T,
    ): Promise<TaskTypeResult<T, Platform.Instagram>> {
        const result = super._match_valid_url(url, InstagramSpider)?.groups
        if (!result) {
            throw new Error(`Invalid URL: ${url}`)
        }
        const { id } = result
        const _url = `${this.BASE_URL}${id}`
        if (task_type === 'article') {
            this.log?.info('Trying to grab posts and highlights.')
            return (await InsApiJsonParser.grabPosts(page, _url)) as TaskTypeResult<T, Platform.Instagram>
        }

        if (task_type === 'follows') {
            this.log?.info('Trying to grab follows.')
            return (await InsApiJsonParser.grabFollowsNumer(page, _url)) as TaskTypeResult<T, Platform.Instagram>
        }

        throw new Error('Invalid task type')
    }
}

namespace InsApiJsonParser {
    const GRAPHQL_FORM_QUERY_KEY = 'fb_api_req_friendly_name'

    const PROFILE_POSTS_KEY = 'PolarisProfilePostsQuery'
    const PROFILE_USER_KEY = 'PolarisProfilePageContentQuery'
    const PROFILE_HIGHLIGHTS_KEY = 'PolarisProfileStoryHighlightsTrayContentQuery'

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

    function parseEdges(json: any): any {
        const edges_json = JSONPath({ path: '$..edges', json })[0]
        if (!edges_json) {
            throw new Error('Edges json format may have changed')
        }
        return edges_json
    }

    function mediaParser(edge: any): Array<GenericMediaInfo> {
        let arr = [] as Array<GenericMediaInfo>
        // cover
        const cover_candidates = edge?.image_versions2?.candidates
        if (cover_candidates) {
            arr.push({
                type: 'photo',
                url: cover_candidates.sort((a: any, b: any) => b.width - a.width)[0]?.url,
            })
        }
        // video
        const video_candidates = edge?.video_versions
        if (video_candidates) {
            arr.push({
                type: 'video',
                url: video_candidates.sort((a: any, b: any) => b.width - a.width)[0]?.url,
            })
        }
        // carousel
        const carousel_media = edge?.carousel_media
        if (carousel_media) {
            // if carousel exists, we do not need the cover
            if (arr.length > 0) {
                arr.shift()
            }
            carousel_media.forEach((media: any) => {
                arr.push({
                    type: 'photo',
                    url: media?.image_versions2?.candidates.sort((a: any, b: any) => b.width - a.width)[0]?.url,
                })
            })
        }
        return Array.from(new Set(arr)).map((m) => {
            return {
                ...m,
                url: m.url.replace('\\u0026', '&'),
            }
        })
    }

    function postParser(edge: any): GenericArticle<Platform.Instagram> {
        const node = edge.node
        return {
            platform: Platform.Instagram,
            a_id: node?.code,
            u_id: node?.user?.username,
            username: node?.user?.full_name,
            created_at: node?.taken_at,
            content: node?.caption?.text,
            url: `https://www.instagram.com/p/${node?.code}/`,
            type: ArticleTypeEnum.POST,
            ref: null,
            has_media: true,
            media: mediaParser(node),
            extra: null,
            u_avatar: node?.user?.hd_profile_pic_url_info?.url.replace('\\u0026', '&'),
        }
    }

    function highlightParser(edge: any): GenericArticle<Platform.Instagram> {
        const node = edge.node
        const id = /\w+[:,](?<id>\d+)/.exec(node?.id)?.groups?.id ?? ''
        return {
            platform: Platform.Instagram,
            a_id: id,
            u_id: node?.user?.username,
            username: '',
            /**
             * TODO: notify when highlight updates
             */
            created_at: 0,
            content: node?.title,
            url: `https://www.instagram.com/stories/highlights/${id}/`,
            type: ArticleTypeEnum.STORIES,
            ref: null,
            has_media: true,
            media: null,
            extra: null,
            u_avatar: null,
        }
    }

    export function highlightsParser(json: any): Array<GenericArticle<Platform.Instagram>> {
        let edges = parseEdges(json)
        return edges.map(highlightParser)
    }

    export function postsParser(json: any): Array<GenericArticle<Platform.Instagram>> {
        let edges = parseEdges(json)
        return edges.map(postParser)
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
     * @param url https://www.instagram.com/username
     * @description grab common posts from user page
     */
    export async function grabPosts(
        page: Page,
        url: string,
        config: {
            viewport?: {
                width: number
                height: number
            }
        } = {
            viewport: {
                width: 954,
                height: 2,
            },
        },
    ): Promise<Array<GenericArticle<Platform.Instagram>>> {
        let reasonable_jsons: any = {
            [PROFILE_POSTS_KEY]: {},
            [PROFILE_HIGHLIGHTS_KEY]: {},
        }
        const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
            const url = response.url()
            const request = response.request()
            if (/graphql\/query$/.test(url) && request.method() === 'POST') {
                try {
                    const postData = request.postData()
                    if (postData?.includes(`${GRAPHQL_FORM_QUERY_KEY}=${PROFILE_POSTS_KEY}`)) {
                        reasonable_jsons[PROFILE_POSTS_KEY] = await response.json()
                    }
                    if (postData?.includes(`${GRAPHQL_FORM_QUERY_KEY}=${PROFILE_HIGHLIGHTS_KEY}`)) {
                        reasonable_jsons[PROFILE_HIGHLIGHTS_KEY] = await response.json()
                    }
                    if (Object.values(reasonable_jsons).every((e: any) => Object.keys(e).length > 0)) {
                        done()
                    }
                } catch (e) {
                    fail(e)
                }
            }
        })
        await page.setViewport(config.viewport ?? { width: 954, height: 2 })
        await page.goto(url)
        try {
            await checkLogin(page)
            await checkSomethingWrong(page)
        } catch (error) {
            cleanup()
            throw error
        }

        const { success, error } = await waitForTweets
        if (!success) {
            throw error
        }
        const posts = postsParser(reasonable_jsons[PROFILE_POSTS_KEY])
        const highlights = highlightsParser(reasonable_jsons[PROFILE_HIGHLIGHTS_KEY]).map((h) => {
            h.username = posts[0]?.username
            h.u_avatar = posts[0]?.u_avatar
            return h
        })
        return posts.concat(highlights)
    }

    export async function grabFollowsNumer(page: Page, url: string): Promise<GenericFollows> {
        let follows_json: any
        const { cleanup, promise: waitForTweets } = waitForResponse(page, async (response, { done, fail }) => {
            const url = response.url()
            if (url.includes('graphql/query') && response.request().method() === 'POST') {
                const postData = response.request().postData()
                if (postData?.includes(`${GRAPHQL_FORM_QUERY_KEY}=${PROFILE_USER_KEY}`)) {
                    if (response.status() >= 400) {
                        fail(new Error(`Error: ${response.status()}`))
                        return
                    }
                    await response
                        .json()
                        .then((json) => {
                            follows_json = json
                            done()
                        })
                        .catch((e) => {
                            fail(e)
                        })
                }
            }
        })
        await page.goto(url)
        try {
            await checkLogin(page)
            await checkSomethingWrong(page)
        } catch (error) {
            cleanup()
            throw error
        }
        const { success, error } = await waitForTweets
        if (!success) {
            throw error
        }
        return followsParser(follows_json)
    }
}

export { ArticleTypeEnum, InsApiJsonParser }
export { InstagramSpider }
