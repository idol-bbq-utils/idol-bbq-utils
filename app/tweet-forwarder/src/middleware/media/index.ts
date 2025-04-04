import fs from 'fs'
import { execSync } from 'child_process'
import { CACHE_DIR_ROOT, log } from '@/config'
import https from 'https'
import path from 'path'
import { MediaToolConfigMap } from '@/types/media'

const MATCH_FILE_NAME = /(?<filename>[^/]+)\.(?<ext>[^.]+)$/

function download(url: string, dest: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        let ext: string | undefined = undefined
        https
            .get(url, (response) => {
                const contentType = response.headers['content-type']
                ext = contentType ? mimeToExt[contentType as keyof typeof mimeToExt] : undefined
                if (ext) {
                    dest += `.${ext}`
                }
                const file = fs.createWriteStream(dest)
                response.pipe(file)
                file.on('finish', () => {
                    file.close(() => resolve(dest))
                })
            })
            .on('error', (error) => {
                if (ext) {
                    dest += `.${ext}`
                }
                if (fs.existsSync(dest)) {
                    fs.unlinkSync(dest)
                }
                reject(error.message)
            })
    })
}

async function plainDownloadMediaFile(url: string, prefix?: string): Promise<string> {
    const _url = new URL(url)
    let filename = MATCH_FILE_NAME.exec(_url.pathname)?.groups?.filename
    if (!filename) {
        filename = Math.random().toString(36).slice(2, 10)
    }
    if (prefix) {
        filename = `${prefix}-${filename}`
    }
    const dest = `${CACHE_DIR_ROOT}/media/plain/${filename}`
    return download(url, dest)
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

function getMediaType(path: string) {
    const ext = path.split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'photo'
    }
    if (['mp4', 'webm', 'mkv', 'mov', 'flv'].includes(ext)) {
        return 'video'
    }
    return 'unknown'
}

const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'image/webp': 'webp',
    'video/x-matroska': 'mkv',
    'video/quicktime': 'mov',
    'video/x-flv': 'flv',
}

export { getMediaType, plainDownloadMediaFile, galleryDownloadMediaFile }
