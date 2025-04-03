import { CommonCfgConfig } from './common'
import { Media } from './media'

enum ForwardToPlatformEnum {
    None = 'none',
    Telegram = 'telegram',
    Bilibili = 'bilibili',
    QQ = 'qq',
}

type PlatformConfigMap = {
    [ForwardToPlatformEnum.None]: {}
    [ForwardToPlatformEnum.Telegram]: {
        token: string
        chat_id: string
    }
    [ForwardToPlatformEnum.Bilibili]: {
        bili_jct: string
        sessdata: string
    }
    /**
     * one11 bot protocol
     */
    [ForwardToPlatformEnum.QQ]: {
        url: string
        group_id: string
        token: string
    }
}

interface ForwardToPlatformCommonConfig {
    replace_regex?: string | Array<string> | Array<Array<string>>
    block_until?: number | string
}

type ForwardToPlatformConfig<T extends ForwardToPlatformEnum = ForwardToPlatformEnum> = PlatformConfigMap[T] &
    ForwardToPlatformCommonConfig

interface ForwarderConfig extends CommonCfgConfig {
    cron?: string
    media?: Media
}

interface ForwardTo<T extends ForwardToPlatformEnum = ForwardToPlatformEnum> {
    platform: T
    /**
     * unique id for the target
     * default is UUID
     */
    id?: string
    cfg_platform: ForwardToPlatformConfig<T>
}

interface Forwarder {
    /**
     * will override the domain and paths
     */
    websites?: Array<string>
    /**
     * should work with paths
     */
    domain?: string
    /**
     * should work with domain
     */
    paths?: Array<string>
    /**
     * Task type defined in `@idol-bbq-utils/spider`
     */
    task_type?: string
    /**
     * Task type like follows need this
     */
    task_title?: string
    /**
     * Array of forwarder target's id, if empty will use all targets
     */
    subscribers?: Array<string>
    cfg_forwarder?: ForwarderConfig
}

export {
    ForwardTo,
    Forwarder,
    ForwarderConfig,
    ForwardToPlatformEnum,
    ForwardToPlatformConfig,
    ForwardToPlatformCommonConfig,
}
