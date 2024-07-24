import { MediaStorageType } from '@/types/bot'

abstract class BaseForwarder {
    protected token: string
    constructor(token: string) {
        this.token = token
    }
    public abstract send(
        text: string,
        media?: Array<{
            type: MediaStorageType
            media_type: string
            path: string
        }>,
    ): Promise<any>
}

export { BaseForwarder }
