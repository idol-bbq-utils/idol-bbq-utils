import fs from 'fs'
import path from 'path'
import type { MediaType } from './types'

export function getMediaType(filePath: string): MediaType {
    const ext = filePath.split('.').pop() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'photo'
    }
    if (['mp4', 'webm', 'mkv', 'mov', 'flv'].includes(ext)) {
        return 'video'
    }
    return 'unknown'
}

export function writeImgToFile(buffer: Buffer<ArrayBufferLike>, cacheDir: string, filename: string): string {
    const dest = path.join(cacheDir, 'media', 'plain', filename)
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(dest, buffer)
    return dest
}

export function cleanupMediaFiles(paths: string[]): void {
    paths.forEach((filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        } catch (e) {
            console.error(`Error while unlinking file ${filePath}: ${e}`)
        }
    })
}
