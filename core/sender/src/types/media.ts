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
        /**
         * 可以为空，默认寻找系统路径中的 gallery-dl
         */
        path?: string
        cookie_file?: string
    }
}

type MediaTool<T extends MediaToolEnum = MediaToolEnum> = {
    tool: T
} & MediaToolConfigMap[T]

enum MediaStorageTypeEnum {
    NONE = 'no-storage',
    DUFS = 'dufs',
}

type MediaStorageConfigMap = {
    [MediaStorageTypeEnum.NONE]: {}
    [MediaStorageTypeEnum.DUFS]: {
        /**
         * Authenticated Dufs directory used by HTTP PUT uploads and token generation.
         * Dufs must use Basic authentication and support `?tokengen` (v0.44.0+).
         */
        upload_url: string
        /**
         * Public URL for the same Dufs directory. Defaults to upload_url.
         * Its path must resolve to the same Dufs-relative path as upload_url.
         */
        public_url?: string
        username: string
        password: string
    }
}

type MediaStorage<T extends MediaStorageTypeEnum = MediaStorageTypeEnum> = {
    type: T
} & MediaStorageConfigMap[T]

type Media<T extends MediaStorageTypeEnum = MediaStorageTypeEnum> = MediaStorage<T> & {
    use: MediaTool
    // TODO
    fallbacks?: Array<MediaTool | MediaToolEnum>
}

export type { Media, MediaStorage, MediaStorageConfigMap, MediaTool, MediaToolConfigMap }
export { MediaStorageTypeEnum, MediaToolEnum }
