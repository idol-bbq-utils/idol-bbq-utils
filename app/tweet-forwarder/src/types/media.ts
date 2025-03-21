enum MediaToolEnum {
    /**
     * Plain http downloader
     */
    DEFAULT = 'default',
    GALLERY_DL = 'gallery-dl',
}

type MediaToolConfigMap = {
    [MediaToolEnum.DEFAULT]: {}
    [MediaToolEnum.GALLERY_DL]: {
        path?: string
        cookie_file?: string
    }
}

type MediaTool<T extends MediaToolEnum = MediaToolEnum> = {
    tool: T
} & MediaToolConfigMap[T]

type MediaStorageType = 'no-storage'

interface Media {
    type: MediaStorageType
    use: MediaTool
    fallbacks?: Array<MediaTool | MediaToolEnum>
}

export { Media }
