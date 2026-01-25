import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { UserAgent } from '@idol-bbq-utils/spider'
import type { MediaType } from '@idol-bbq-utils/utils'
import type { GalleryDLConfig } from './types'
import { mimeToExt } from './mime'

const MATCH_FILE_NAME = /(?<filename>[^/]+)\.(?<ext>[^.]+)$/

export async function downloadFile(
    url: string,
    headers?: Record<string, string>,
): Promise<{
    contentType: string
    file: Buffer
}> {
    const res = await fetch(url, {
        credentials: 'include',
        headers: {
            'user-agent': UserAgent.CHROME,
            ...headers,
        },
        redirect: 'manual',
    })
    if ([301, 302, 307, 308].includes(res.status)) {
        const location = res.headers.get('location')
        if (location) {
            return downloadFile(location, headers)
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

export async function plainDownloadMediaFile(
    url: string,
    cacheDir: string,
    prefix?: string,
    headers?: Record<string, string>,
): Promise<string> {
    const _url = new URL(url)
    let filename = MATCH_FILE_NAME.exec(_url.pathname)?.groups?.filename
    if (!filename) {
        filename = Math.random().toString(36).slice(2, 10)
    }
    if (prefix) {
        filename = `${prefix}-${filename}`
    }
    let dest = path.join(cacheDir, 'media', 'plain', filename)
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    let ext: string | undefined = undefined
    const { file, contentType } = await downloadFile(url, headers)
    ext = contentType ? mimeToExt[contentType as keyof typeof mimeToExt] : undefined
    if (ext) {
        dest += `.${ext}`
    }
    fs.writeFileSync(dest, file)
    return dest
}

export function galleryDownloadMediaFile(
    url: string,
    cacheDir: string,
    gallery_dl?: GalleryDLConfig,
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

    args.push(`--directory ${path.join(cacheDir, 'media', 'gallery-dl')}`)
    args.push(url)

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
        return res
    } catch (e) {
        console.error('download media files failed', e)
        return []
    }
}

export async function tryGetCookie(url: string): Promise<string | undefined> {
    let cookie_string: string | null = null
    try {
        const res = await fetch(url)
        cookie_string = res.headers.get('set-cookie')
    } catch (e) {}
    if (!cookie_string) {
        return
    }

    const cookies = cookie_string.split(/,\s*(?=[a-zA-Z0-9_-]+=)/)
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
