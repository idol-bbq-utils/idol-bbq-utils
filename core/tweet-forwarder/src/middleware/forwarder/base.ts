import { MediaStorageType, SourcePlatformEnum } from '@/types/bot'

abstract class BaseForwarder {
    protected token: string
    protected name: string = 'base-forwarder'
    constructor(token: string) {
        this.token = token
    }
    public abstract send(
        text: string,
        media?: Array<{
            source: SourcePlatformEnum
            type: MediaStorageType
            media_type: string
            path: string
        }>,
    ): Promise<any>
}

export { BaseForwarder }
