import axios from 'axios'
import { BaseForwarder, Forwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
import { SourcePlatformEnum } from '@/types/bot'
import FormData from 'form-data'
import fs from 'fs'

const BASIC_TEXT_LIMIT = 1000
const CHUNK_SEPARATOR_NEXT = '\n\n----⬇️----'
const CHUNK_SPSERATOR_PREV = '----⬆️----\n\n'
const PADDING_LENGTH = 24
const TEXT_LIMIT = BASIC_TEXT_LIMIT - CHUNK_SEPARATOR_NEXT.length - CHUNK_SPSERATOR_PREV.length - PADDING_LENGTH

class BiliForwarder extends Forwarder {
    private bili_jct: string
    name = 'bilibili'
    constructor(bili_jct: string, ...args: [...ConstructorParameters<typeof Forwarder>]) {
        super(...args)
        if (!bili_jct) {
            throw new Error(`forwarder ${this.name} bili_jct is required`)
        }
        this.bili_jct = bili_jct
    }
    public async realSend(text: string, props: Parameters<BaseForwarder['send']>[1]) {
        const { media } = props || {}
        const has_media = media && media.length !== 0
        await pRetry(() => (has_media ? this.sendPhotoText(text, media) : this.sendPureText(text)), {
            retries: 2,
            onFailedAttempt(error) {
                log.error(
                    `Send text to bilibili failed. There are ${error.retriesLeft} retries left. ${error.originalError.message}`,
                )
            },
        })
        return
    }
    async sendPureText(text: string) {
        let _res = []
        let text_to_be_sent = text
        let i = 0
        while (text_to_be_sent.length > BASIC_TEXT_LIMIT) {
            const current_chunk = text_to_be_sent.slice(0, TEXT_LIMIT)
            const res = await this.sendText(
                `${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${current_chunk}${CHUNK_SEPARATOR_NEXT}`,
            )
            _res.push(res)
            text_to_be_sent = text_to_be_sent.slice(TEXT_LIMIT)
            i = i + 1
        }
        const res = await this.sendText(`${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${text_to_be_sent}`)
        _res.push(res)
        _res.forEach((res) => {
            if (res.data.code !== 0) {
                throw new Error(`Send text to ${this.name} failed. ${res.data.message}`)
            }
        })
        return _res
    }
    async sendPhotoText(
        text: string,
        media: Array<{
            source: SourcePlatformEnum
            type: string
            media_type: string
            path: string
        }>,
    ) {
        let pics: Array<{
            img_src: string
            img_width: number
            img_height: number
            img_size: number
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
        )
            .filter((i) => i !== undefined)
            .map((i) => ({
                img_src: i.image_url,
                img_width: i.image_width,
                img_height: i.image_height,
                img_size: i.image_size,
            }))
        pics = pics.slice(0, 9)
        log.debug(`pics: ${pics}`)
        if (pics.length === 0) {
            return this.sendPureText(text)
        }
        log.debug(`Send text with photos..., media: ${media}`)
        let _res = []
        let text_to_be_sent = text
        let i = 0
        while (text_to_be_sent.length > BASIC_TEXT_LIMIT) {
            const current_chunk = text_to_be_sent.slice(0, TEXT_LIMIT)
            const res = await this.sendTextWithPhotos(
                `${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${current_chunk}${CHUNK_SEPARATOR_NEXT}`,
                pics,
            )
            _res.push(res)
            text_to_be_sent = text_to_be_sent.slice(TEXT_LIMIT)
            i = i + 1
        }
        const res = await this.sendTextWithPhotos(`${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${text_to_be_sent}`, pics)
        _res.push(res)
        _res.forEach((res) => {
            if (res.data.code !== 0) {
                throw new Error(`Send text to ${this.name} failed. ${res.data.message}`)
            }
        })
        return _res
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

    async sendText(text: string) {
        const res = await axios.post(
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
        return res
    }

    async sendTextWithPhotos(
        text: string,
        pics: Array<{
            img_src: string
            img_width: number
            img_height: number
            img_size: number
        }>,
    ) {
        const res = await axios.post(
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
                    pics: pics,
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
        return res
    }
}

export { BiliForwarder }
