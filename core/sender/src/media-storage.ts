import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { MediaStorageTypeEnum, type Media, type MediaStorage } from './types'

interface StoredMedia {
    key: string
    url: string
}

interface MediaStorageClient {
    upload(filePath: string): Promise<StoredMedia>
}

function normalizeDirectoryUrl(value: string, name: string): URL {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`${name} must use http or https`)
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
    return url
}

class DufsMediaStorage implements MediaStorageClient {
    private readonly uploadUrl: URL
    private readonly publicUrl: URL
    private readonly authorization: string

    constructor(config: MediaStorage<MediaStorageTypeEnum.DUFS>) {
        this.uploadUrl = normalizeDirectoryUrl(config.upload_url, 'media.upload_url')
        this.publicUrl = normalizeDirectoryUrl(config.public_url ?? config.upload_url, 'media.public_url')
        this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
    }

    async upload(filePath: string): Promise<StoredMedia> {
        const content = await readFile(filePath)
        const hash = createHash('sha256').update(content).digest('hex')
        const extension = path
            .extname(filePath)
            .toLowerCase()
            .replace(/[^a-z0-9.]/g, '')
        const key = `${hash}${extension}`
        const uploadUrl = new URL(encodeURIComponent(key), this.uploadUrl)

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                Authorization: this.authorization,
                'Content-Type': 'application/octet-stream',
            },
            body: content,
        })

        if (!response.ok) {
            const responseText = await response.text().catch(() => '')
            throw new Error(
                `Dufs upload failed with ${response.status} ${response.statusText}${responseText ? `: ${responseText}` : ''}`,
            )
        }

        const tokenUrl = new URL(uploadUrl)
        tokenUrl.searchParams.set('tokengen', '')
        const tokenResponse = await fetch(tokenUrl, {
            headers: {
                Authorization: this.authorization,
            },
        })

        if (!tokenResponse.ok) {
            const responseText = await tokenResponse.text().catch(() => '')
            throw new Error(
                `Dufs token generation failed with ${tokenResponse.status} ${tokenResponse.statusText}${responseText ? `: ${responseText}` : ''}`,
            )
        }

        const token = (await tokenResponse.text()).trim()
        if (!token) {
            throw new Error('Dufs token generation returned an empty token')
        }

        const publicUrl = new URL(encodeURIComponent(key), this.publicUrl)
        publicUrl.searchParams.set('token', token)

        return {
            key,
            url: publicUrl.toString(),
        }
    }
}

function createMediaStorage(media?: Media): MediaStorageClient | undefined {
    if (!media || media.type === MediaStorageTypeEnum.NONE) {
        return undefined
    }

    switch (media.type) {
        case MediaStorageTypeEnum.DUFS:
            return new DufsMediaStorage(media as Media<MediaStorageTypeEnum.DUFS>)
        default:
            throw new Error(`Unsupported media storage type: ${String((media as Media).type)}`)
    }
}

export { DufsMediaStorage, createMediaStorage }
export type { MediaStorageClient, StoredMedia }
