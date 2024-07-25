import axios from 'axios'
import { BaseForwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
import { SourcePlatformEnum } from '@/types/bot'
import FormData from 'form-data'
import fs from 'fs'
class BiliForwarder extends BaseForwarder {
    private bili_jct: string
    constructor(token: string, bili_jct: string) {
        super(token)
        this.bili_jct = bili_jct
    }
    public async send(
        text: string,
        media?: Array<{
            source: SourcePlatformEnum
            type: string
            media_type: string
            path: string
        }>,
    ) {
        const has_media = media && media.length !== 0
        await pRetry(() => (has_media ? this.sendTextWithPhotos(text, media) : this.sendPureText(text)), {
            retries: 2,
            onFailedAttempt(error) {
                log.error(
                    `Send text to bilibili failed. There are ${error.retriesLeft} retries left. ${error.originalError.message}`,
                )
            },
        })
        return
    }
    sendPureText(text: string) {
        return axios.post(
            'https://api.bilibili.com/x/dynamic/feed/create/dyn',
            {
                dyn_req: {
                    content: {
                        contents: [
                            {
                                raw_text: text,
                                type: 1,
                                biz_id: '',
                            },
                        ],
                    },
                    scene: 1,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `SESSDATA=${this.token}`,
                },
                params: {
                    csrf: this.bili_jct,
                },
            },
        )
    }
    async sendTextWithPhotos(
        text: string,
        media: Array<{
            source: SourcePlatformEnum
            type: string
            media_type: string
            path: string
        }>,
    ) {
        log.debug(`Send text with photos..., media: ${media}`)
        let pics: Array<{
            image_url: string
            image_width: number
            image_height: number
            image_size: number
        }> = (
            await Promise.all(
                media.map(async (item) => {
                    if (item.media_type === 'photo') {
                        try {
                            log.debug(`Uploading photo ${item.path}`)
                            const obj = await pRetry(() => this.uploadPhoto(item.path), {
                                retries: 2,
                                onFailedAttempt() {
                                    log.error('Upload photo failed, retrying...')
                                },
                            })
                            log.debug(obj)
                            return obj
                        } catch (e) {
                            log.error(`Upload photo ${item.path} failed, skip this photo`)
                            return
                        }
                    }
                    // video to gif
                }),
            )
        ).filter((i) => i !== undefined)
        pics = pics.slice(0, 9)
        log.debug(`pics: ${pics}`)
        return axios.post(
            'https://api.bilibili.com/x/dynamic/feed/create/dyn',
            {
                dyn_req: {
                    content: {
                        contents: [
                            {
                                raw_text: text,
                                type: 1,
                                biz_id: '',
                            },
                        ],
                    },
                    pics: pics.map((i) => ({
                        img_src: i.image_url,
                        img_width: i.image_width,
                        img_height: i.image_height,
                        img_size: i.image_size,
                    })),
                    scene: 2,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `SESSDATA=${this.token}`,
                },
                params: {
                    csrf: this.bili_jct,
                },
            },
        )
    }
    async uploadPhoto(path: string) {
        const form = new FormData()
        form.append('file_up', fs.createReadStream(path))
        form.append('category', 'daily')
        const res = await axios.post('https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs', form, {
            headers: {
                ...form.getHeaders(),
                Cookie: `SESSDATA=${this.token}`,
            },
            params: {
                csrf: this.bili_jct,
            },
        })
        return res.data.data
    }
}

export { BiliForwarder }
