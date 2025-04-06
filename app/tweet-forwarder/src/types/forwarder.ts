import { TaskType } from '@idol-bbq-utils/spider/types'
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

type TaskConfigMap = {
    article: {}
    follows: {
        /**
         *
         * "7d", "1w", "30d", "2h"...
         *
         * default is `1d`
         * ```
         * export type UnitTypeShort = 'd' | 'D' | 'M' | 'y' | 'h' | 'm' | 's' | 'ms'
         * export type UnitTypeLong = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'date'
         * export type UnitTypeLongPlural = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years' | 'dates'
         * ```
         */
        comparison_window?: string
    }
}

type TaskConfig<T extends TaskType> = TaskConfigMap[T]

interface ForwardToPlatformCommonConfig {
    replace_regex?: string | Array<string> | Array<Array<string>>
    /**
     *
     * if 1d, the forwarder will only forward the article that created within 1 day
     * "7d", "1w", "30d", "2h"...
     *
     * default is `30m`
     * ```
     * export type UnitTypeShort = 'd' | 'D' | 'M' | 'y' | 'h' | 'm' | 's' | 'ms'
     * export type UnitTypeLong = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'date'
     * export type UnitTypeLongPlural = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years' | 'dates'
     * ```
     */
    block_until?: string
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

interface Forwarder<T extends TaskType> {
    /**
     * Display only
     */
    name?: string
    /**
     * will override the origin and paths
     */
    websites?: Array<string>
    /**
     * should work with paths
     */
    origin?: string
    /**
     * should work with origin
     */
    paths?: Array<string>
    /**
     * Task type defined in `@idol-bbq-utils/spider`
     */
    task_type?: T
    /**
     * Task type like follows need this
     */
    task_title?: string
    /**
     *
     */
    cfg_task?: TaskConfig<T>
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
