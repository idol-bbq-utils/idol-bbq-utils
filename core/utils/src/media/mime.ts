import type { ImageContentType, VideoContentType, ImageExtType, VideoExtType } from './types'

export const mimeToExt: {
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

export const extToMime = Object.fromEntries(Object.entries(mimeToExt).map(([mime, ext]) => [ext, mime])) as {
    [K in ImageExtType]: ImageContentType
} & {
    [V in VideoExtType]: VideoContentType
}
