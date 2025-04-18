import { ForwardToPlatformEnum } from '@/types/forwarder'
import { BaseForwarder } from './base'
import { BiliForwarder } from './bilibili'
import { QQForwarder } from './qq'
import { TgForwarder } from './telegram'

interface ForwarderConstructor {
    _PLATFORM: ForwardToPlatformEnum
    new (...args: ConstructorParameters<typeof BaseForwarder>): BaseForwarder
}

const forwarders: Array<ForwarderConstructor> = [BiliForwarder, QQForwarder, TgForwarder]

function getForwarder(platform: ForwardToPlatformEnum): ForwarderConstructor | null {
    for (const forwarder of forwarders) {
        if (forwarder._PLATFORM.toLowerCase() === platform.toLowerCase()) {
            return forwarder
        }
    }
    return null
}

export { getForwarder }
export type { ForwarderConstructor }
