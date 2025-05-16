import fs, { writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { CACHE_DIR_ROOT, log } from '@/config'
import path from 'path'
import type { MediaToolConfigMap } from '@/types/media'
import type { MediaType } from '@idol-bbq-utils/spider/types'
import { UserAgent } from '@idol-bbq-utils/spider'

const MATCH_FILE_NAME = /(?<filename>[^/]+)\.(?<ext>[^.]+)$/

function writeImgToFile(buffer: Buffer<ArrayBufferLike>, filename: string): string {
    const dest = `${CACHE_DIR_ROOT}/media/plain/${filename}`
    writeFileSync(dest, buffer)
    return dest
}

async function downloadFile(
    url: string,
    cookie?: string,
): Promise<{
    contentType: string
    file: Buffer
}> {
    const res = await fetch(url, {
        credentials: 'include',
        headers: {
            'user-agent': UserAgent.CHROME,
            cookie: cookie || '',
        },
        redirect: 'manual',
    })
    if ([301, 302, 307, 308].includes(res.status)) {
        const location = res.headers.get('location')
        if (location) {
            return downloadFile(location, cookie)
        } else {
            throw new Error(`Failed to download file: ${res.status} ${res.statusText} ${url}`)
        }
    }

    if (res.status >= 400) {
        throw new Error(`Failed to download file: ${res.status} ${res.statusText} ${url}`)
    }
    const file = await res.arrayBuffer()
    return {
        contentType: res.headers.get('content-type') || 'application/octet-stream',
        file: Buffer.from(file),
    }
}

async function plainDownloadMediaFile(url: string, prefix?: string, cookie?: string): Promise<string> {
    const _url = new URL(url)
    let filename = MATCH_FILE_NAME.exec(_url.pathname)?.groups?.filename
    if (!filename) {
        filename = Math.random().toString(36).slice(2, 10)
    }
    if (prefix) {
        filename = `${prefix}-${filename}`
    }
    let dest = `${CACHE_DIR_ROOT}/media/plain/${filename}`
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    let ext: string | undefined = undefined
    const { file, contentType } = await downloadFile(url, cookie)
    ext = contentType ? mimeToExt[contentType as keyof typeof mimeToExt] : undefined
    if (ext) {
        dest += `.${ext}`
    }
    fs.writeFileSync(dest, file)
    return dest
}

async function tryGetCookie(url: string) {
    const res = await fetch(url)
    const cookieString = res.headers.get('set-cookie')
    if (!cookieString) {
        return
    }
    // Split the cookie string into individual cookies
    const cookies = cookieString.split(/,\s*(?=[a-zA-Z0-9_-]+=)/)

    // Process each cookie to extract the key-value pairs
    const cookieArr = [] as Array<string>

    cookies.forEach((cookie) => {
        const parts = cookie.split(';').map((part) => part.trim())

        const [keyValue, ...attributes] = parts
        if (keyValue) {
            cookieArr.push(keyValue)
        }
    })

    return cookieArr.join('; ')
}

function galleryDownloadMediaFile(
    url: string,
    gallery_dl: MediaToolConfigMap['gallery-dl'],
    /**
     * TODO
     */
    prefix?: string,
): string[] {
    if (!gallery_dl) {
        return []
    }
    let args = []
    let exec_path = 'gallery-dl'
    if (gallery_dl.cookie_file) {
        args.push(`--cookies ${gallery_dl.cookie_file}`)
    }
    if (gallery_dl.path) {
        exec_path = gallery_dl.path
    }

    args.push(`--directory ${CACHE_DIR_ROOT}/media/gallery-dl`)
    args.push(url)
    log.debug(`downloading media files with args: ${args}`)
    try {
        const res = execSync(`${exec_path} ${args.join(' ')}`, { encoding: 'utf-8' })
            .split('\n')
            .filter((path) => path !== '')
            .map((path) => {
                if (path.startsWith('# ')) {
                    return path.slice(2)
                }
                return path
            })
        log.debug(`downloaded media files: ${res}`)
        return res
    } catch (e) {
        log.error('download media files failed', e)
        return []
    }
}

function getMediaType(path: string): MediaType {
    const ext = path.split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'photo'
    }
    if (['mp4', 'webm', 'mkv', 'mov', 'flv'].includes(ext)) {
        return 'video'
    }
    return 'unknown'
}

type ImageContentType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
type VideoContentType = 'video/mp4' | 'video/webm' | 'video/x-matroska' | 'video/quicktime' | 'video/x-flv'

type ImageExtType = 'jpg' | 'png' | 'gif' | 'webp'
type VideoExtType = 'mp4' | 'webm' | 'mkv' | 'mov' | 'flv'

const mimeToExt: {
    [K in ImageContentType]: ImageExtType
} & {
    [V in VideoContentType]: VideoExtType
} = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'image/webp': 'webp',
    'video/x-matroska': 'mkv',
    'video/quicktime': 'mov',
    'video/x-flv': 'flv',
} as const

const extToMime = Object.fromEntries(Object.entries(mimeToExt).map(([mime, ext]) => [ext, mime])) as {
    [K in ImageExtType]: ImageContentType
} & {
    [V in VideoExtType]: VideoContentType
}

type FileContentType = ImageContentType | VideoContentType

export {
    getMediaType,
    plainDownloadMediaFile,
    galleryDownloadMediaFile,
    writeImgToFile,
    extToMime,
    mimeToExt,
    tryGetCookie,
}
export type { FileContentType }
