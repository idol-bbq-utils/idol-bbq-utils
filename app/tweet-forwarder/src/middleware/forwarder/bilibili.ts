import axios from 'axios'
import { Forwarder, type SendProps } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import FormData from 'form-data'
import fs from 'fs'
import { type ForwardTargetPlatformConfig, ForwardTargetPlatformEnum } from '@/types/forwarder'

interface BiliImageUploaded {
    img_src: string
    img_width: number
    img_height: number
    img_size: number
}

class BiliForwarder extends Forwarder {
    static _PLATFORM = ForwardTargetPlatformEnum.Bilibili
    NAME = 'bilibili'
    private bili_jct: string
    private sessdata: string
    private media_check_level: ForwardTargetPlatformConfig<ForwardTargetPlatformEnum.Bilibili>['media_check_level']
    protected override BASIC_TEXT_LIMIT = 1000

    constructor(...[config, ...rest]: [...ConstructorParameters<typeof Forwarder>]) {
        super(config, ...rest)
        const {
            bili_jct,
            sessdata,
            media_check_level = 'none',
        } = config as ForwardTargetPlatformConfig<ForwardTargetPlatformEnum.Bilibili>
        if (!bili_jct || !sessdata) {
            throw new Error(`forwarder ${this.NAME} bili_jct and sessdata are required`)
        }
        this.bili_jct = bili_jct
        this.sessdata = sessdata
        this.media_check_level = media_check_level
    }

    protected async realSend(texts: string[], props?: SendProps): Promise<any> {
        let { media } = props || {}
        media = media || []
        const _log = this.log
        let pics: Array<BiliImageUploaded> = (
            await Promise.all(
                media.map(async (item) => {
                    if (item.media_type === 'photo' || item.media_type === 'video_thumbnail') {
                        try {
                            _log?.debug(`Uploading photo ${item.path}`)
                            const obj = await pRetry(() => this.uploadPhoto(item.path), {
                                retries: 2,
                                onFailedAttempt() {
                                    _log?.error('Upload photo failed, retrying...')
                                },
                            })
                            return obj
                        } catch (e) {
                            _log?.error(`Upload photo ${item.path} failed, skip this photo`)
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
        if (this.media_check_level === 'loose' && media.length !== 0 && pics.length === 0) {
            _log?.error(`No photos uploaded, throw error.`)
            throw new Error(`No photos uploaded, please check your bili_jct and sessdata.`)
        }
        if (this.media_check_level === 'strict' && media.length !== pics.length) {
            _log?.error(`Some photos upload failed.`)
            throw new Error(`Some photos upload failed, please check your bili_jct and sessdata.`)
        }
        // TODO: more pics support
        pics = pics.slice(0, 9)
        if (pics.length > 0) {
            _log?.debug(`pics: ${pics}`)
            _log?.debug(`Send text with photos..., media: ${media}`)
        }
        const _res = []
        for (const t of texts) {
            _log?.debug(`Send text: ${t}`)
            const res = await (pics.length ? this.sendTextWithPhotos(t, pics) : this.sendText(t))
            _res.push(res)
        }
        _res.forEach((res) => {
            if (res.data.code !== 0) {
                throw new Error(`Send text to ${this.NAME} failed. ${res.data.message}: ${JSON.stringify(res.data)}`)
            }
        })
        return _res
    }

    private async uploadPhoto(path: string) {
        const form = new FormData()
        form.append('file_up', fs.createReadStream(path))
        form.append('category', 'daily')
        form.append('csrf', this.bili_jct)
        const res = await axios.post('https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs', form, {
            headers: {
                ...form.getHeaders(),
                Cookie: `SESSDATA=${this.sessdata}`,
            },
        })
        this.log?.debug(`Upload photo response: ${JSON.stringify(res.data)}`)
        return res.data.data
    }

    private async sendText(text: string) {
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
                    Cookie: `SESSDATA=${this.sessdata}`,
                },
                params: {
                    csrf: this.bili_jct,
                },
            },
        )
    }

    private async sendTextWithPhotos(
        text: string,
        pics: Array<{
            img_src: string
            img_width: number
            img_height: number
            img_size: number
        }>,
    ) {
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
                    pics: pics,
                    scene: 2,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `SESSDATA=${this.sessdata}`,
                },
                params: {
                    csrf: this.bili_jct,
                },
            },
        )
    }
}

export { BiliForwarder }
