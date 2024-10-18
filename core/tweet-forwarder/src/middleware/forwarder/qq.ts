import axios from 'axios'
import { BaseForwarder } from './base'
import { pRetry } from '@idol-bbq-utils/utils'
import { log } from '@/config'
import { SourcePlatformEnum } from '@/types/bot'

const BASIC_TEXT_LIMIT = 4000
const CHUNK_SEPARATOR_NEXT = '\n\n----⬇️----'
const CHUNK_SPSERATOR_PREV = '----⬆️----\n\n'
const PADDING_LENGTH = 24
const TEXT_LIMIT = BASIC_TEXT_LIMIT - CHUNK_SEPARATOR_NEXT.length - CHUNK_SPSERATOR_PREV.length - PADDING_LENGTH

class QQForwarder extends BaseForwarder {
    private group_id: string
    private url: string
    name = 'qq'
    constructor(token: string, group_id: string, url: string) {
        super(token)
        if (!group_id) {
            throw new Error(`forwarder ${this.name} group_id is required`)
        }
        if (!url) {
            throw new Error(`forwarder ${this.name} url is required`)
        }
        this.group_id = group_id
        this.url = url
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
        await pRetry(() => this.sendPhotoText(text, media || []), {
            retries: 2,
            onFailedAttempt(error) {
                log.error(
                    `Send text to qq group failed. There are ${error.retriesLeft} retries left. ${error.originalError.message}`,
                )
            },
        })
        return
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
        log.debug(`Send text with photos..., media: ${media}`)
        let pics: Array<{
            type: 'image'
            data: {
                file: string
            }
        }> = media
            .filter((i) => i.media_type === 'photo')
            .map((i) => ({
                type: 'image',
                data: {
                    file: `file:///${i.path}`,
                },
            }))
        let videos: Array<{
            type: 'video'
            data: {
                file: string
            }
        }> = media
            .filter((i) => i.media_type === 'video')
            .map((i) => ({
                type: 'video',
                data: {
                    file: `file:///${i.path}`,
                },
            }))
        log.debug(`pics: ${pics}`)
        log.debug(`videos: ${videos}`)

        let _res = []
        let text_to_be_sent = text
        let i = 0
        while (text_to_be_sent.length > BASIC_TEXT_LIMIT) {
            const current_chunk = text_to_be_sent.slice(0, TEXT_LIMIT)
            const res = await this.sendWithPayload([
                {
                    type: 'text',
                    data: {
                        text: `${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${current_chunk}${CHUNK_SEPARATOR_NEXT}`,
                    },
                },
                ...pics,
            ])
            _res.push(res)
            text_to_be_sent = text_to_be_sent.slice(TEXT_LIMIT)
            i = i + 1
        }
        const res = await this.sendWithPayload([
            {
                type: 'text',
                data: {
                    text: `${i > 0 ? CHUNK_SPSERATOR_PREV : ''}${text_to_be_sent}`,
                },
            },
            ...pics,
        ])
        _res.push(res)

        const maybe_video_res = videos.length !== 0 && (await this.sendWithPayload(videos))
        maybe_video_res && _res.push(maybe_video_res)
        _res.forEach((res) => {
            if (res.data.status !== 'ok') {
                throw new Error(`Send text to ${this.name} failed. ${res.data.message}`)
            }
        })
        return _res
    }
    async sendWithPayload(
        arr_of_segments: Array<
            | {
                  type: 'text'
                  data: {
                      text: string
                  }
              }
            | {
                  type: 'image'
                  data: {
                      file: string
                  }
              }
            | {
                  type: 'video'
                  data: {
                      file: string
                  }
              }
        >,
    ) {
        const res = await axios.post(
            `${this.url}/send_group_msg`,
            {
                group_id: this.group_id,
                message: arr_of_segments,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            },
        )
        return res
    }
}

export { QQForwarder }
