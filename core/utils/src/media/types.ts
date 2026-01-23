export type MediaType = 'photo' | 'video' | 'video_thumbnail' | 'unknown'

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
export type VideoContentType = 'video/mp4' | 'video/webm' | 'video/x-matroska' | 'video/quicktime' | 'video/x-flv'
export type FileContentType = ImageContentType | VideoContentType

export type ImageExtType = 'jpg' | 'png' | 'gif' | 'webp'
export type VideoExtType = 'mp4' | 'webm' | 'mkv' | 'mov' | 'flv'

export interface MediaToolConfig {
    tool: 'default' | 'gallery-dl'
    path?: string
    cookie_file?: string
}

export interface GalleryDLConfig {
    path?: string
    cookie_file?: string
}

export interface DownloadedMedia {
    path: string
    media_type: 'photo' | 'video' | 'unknown'
}
