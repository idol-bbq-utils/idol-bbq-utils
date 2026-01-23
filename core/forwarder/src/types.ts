import type { Platform, TaskType } from '@idol-bbq-utils/spider/types'

export enum ForwardTargetPlatformEnum {
    None = 'none',
    Telegram = 'telegram',
    Bilibili = 'bilibili',
    QQ = 'qq',
}

type PlatformConfigMap = {
    [ForwardTargetPlatformEnum.None]: {}
    [ForwardTargetPlatformEnum.Telegram]: {
        token: string
        chat_id: string
    }
    [ForwardTargetPlatformEnum.Bilibili]: {
        bili_jct: string
        sessdata: string
        media_check_level?: 'strict' | 'loose' | 'none'
    }
    [ForwardTargetPlatformEnum.QQ]: {
        url: string
        group_id: string
        token: string
    }
}

export interface ForwardTargetPlatformCommonConfig {
    replace_regex?: string | [string, string] | Array<[string, string]>
    block_until?: string
    accept_keywords?: Array<string>
    filter_keywords?: Array<string>
    block_rules?: Array<{
        platform: Platform
        task_type?: TaskType
        sub_type?: Array<string>
        block_type?: 'always' | 'none' | 'once' | 'once.media'
        block_until?: string
    }>
}

export type ForwardTargetPlatformConfig<T extends ForwardTargetPlatformEnum = ForwardTargetPlatformEnum> =
    PlatformConfigMap[T]

export interface ForwardTarget<T extends ForwardTargetPlatformEnum = ForwardTargetPlatformEnum> {
    platform: T
    id?: string
    cfg_platform: ForwardTargetPlatformConfig<T> & ForwardTargetPlatformCommonConfig
}
