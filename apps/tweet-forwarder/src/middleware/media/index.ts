import fs from 'fs'
import { execSync } from 'child_process'
import { CACHE_DIR_ROOT, log } from '@/config'
import { IWebsiteConfig } from '@/types/bot'
import https from 'https'
import { plainUrlConventor } from './x'
import path from 'path'

function download(url: string, dest: string) {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        const file = fs.createWriteStream(dest)
        https
            .get(url, (response) => {
                response.pipe(file)
                file.on('finish', () => {
                    file.close(() => resolve(true))
                })
            })
            .on('error', (error) => {
                fs.unlinkSync(dest)
                reject(error.message)
            })
    })
}

// TODO: use class instead of function
async function plainDownloadMediaFile(url: string): Promise<string | undefined> {
    const _ = plainUrlConventor(url)
    if (_) {
        const { url, filename } = _
        const dest = `${CACHE_DIR_ROOT}/gallery-dl/plain/${filename}`
        await download(url, dest)
        return dest
    }
}

function downloadMediaFiles(
    url: string,
    gallery_dl: Extract<IWebsiteConfig['media'], { gallery_dl: any }>['gallery_dl'],
) {
    if (!gallery_dl) {
        return []
    }
    let args = []
    let exec_path = 'gallery-dl'
    if (typeof gallery_dl === 'object') {
        if (gallery_dl.cookie_file) {
            args.push(`--cookies ${gallery_dl.cookie_file}`)
        }
        if (gallery_dl.path) {
            exec_path = gallery_dl.path
        }
    }

    args.push(`--directory ${CACHE_DIR_ROOT}/gallery-dl`)
    args.push(`--filename {_now:%M%S%m}_{tweet_id}_{num}.{extension}`)
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

function cleanMediaFiles(paths: string[]) {
    paths.forEach((path) => {
        fs.unlinkSync(path)
    })
}

function getMediaType(path: string) {
    const ext = path.split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'photo'
    }
    if (['mp4', 'webm'].includes(ext)) {
        return 'video'
    }
    return 'unknown'
}

export { downloadMediaFiles, cleanMediaFiles, getMediaType, plainDownloadMediaFile }
