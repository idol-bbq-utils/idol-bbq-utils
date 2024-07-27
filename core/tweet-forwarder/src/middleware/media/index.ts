import os from 'os'
import fs from 'fs'
import { execSync } from 'child_process'

function downloadMediaFiles(
    url: string,
    gallery_dl: {
        path: string
        cookie_file?: string
    },
) {
    let args = []
    if (gallery_dl.cookie_file) {
        args.push(`--cookies ${gallery_dl.cookie_file}`)
    }
    args.push(`--directory ${os.tmpdir()}/gallery-dl`)
    args.push(`--filename {_now:%M%S%m}_{tweet_id}_{num}.{extension}`)
    args.push(url)
    const res = execSync(`${gallery_dl.path} ${args.join(' ')}`, { encoding: 'utf-8' })
        .split('\n')
        .filter((path) => path !== '')
        .map((path) => {
            if (path.startsWith('# ')) {
                return path.slice(2)
            }
            return path
        })
    return res
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

export { downloadMediaFiles, cleanMediaFiles, getMediaType }
