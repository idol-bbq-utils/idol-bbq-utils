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

interface ForwarderConfig extends ForwardToPlatformCommonConfig, CommonCfgConfig {
    cron?: string
    media: Media
}

interface ForwarderTarget<T extends ForwardToPlatformEnum = ForwardToPlatformEnum> {
    platform: T
    /**
     * unique id for the target
     * default is UUID
     */
    id?: string
    cfg_platform: ForwardToPlatformConfig<T>
}

/**
 * Array of forwarder target's id
 */
type ForwardTo = Array<string | ForwarderTarget>

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
     * Array of forwarder target's id
     */
    forward_to?: ForwardTo
    /**
     * Allow merging the forwarder target's from root, default is false and will override the forward_to
     */
    merge_forward_to?: boolean
    cfg_forwarder?: ForwarderConfig
}

export { ForwarderTarget, Forwarder, ForwarderConfig, ForwardTo, ForwardToPlatformEnum, ForwardToPlatformConfig }
