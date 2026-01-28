import type { Platform, TaskType } from '@idol-bbq-utils/spider/types'
import type { CommonCfgConfig } from '@idol-bbq-utils/utils'
import type { Media } from './media'

enum SendTargetPlatformEnum {
    None = 'none',
    Telegram = 'telegram',
    Bilibili = 'bilibili',
    QQ = 'qq',
}

type PlatformConfigMap = {
    [SendTargetPlatformEnum.None]: {}
    [SendTargetPlatformEnum.Telegram]: {
        token: string
        chat_id: string
    }
    [SendTargetPlatformEnum.Bilibili]: {
        bili_jct: string
        sessdata: string
        media_check_level?: 'strict' | 'loose' | 'none'
    }
    /**
     * one11 bot protocol
     */
    [SendTargetPlatformEnum.QQ]: {
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

type TaskConfig<T extends TaskType> = TaskConfigMap[T] & {
    task_title?: string
}

interface SendTargetCommonConfig extends CommonCfgConfig {
    replace_regex?: string | [string, string] | Array<[string, string]>
    /**
     *
     * if 1d, the sender will only forward the article that created within 1 day
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
    accept_keywords?: Array<string>
    filter_keywords?: Array<string>
    /**
     * Block rule for the forwarder
     *
     * For example:
     *
     * ```
     * platform: Platform.X
     * task_type: 'article'
     * sub_type: ['retweet']
     * block_type: 'once'
     * block_until: '6h'
     * ```
     *
     * This will only send once which article type is retweet from X.
     * And other retweets will be blocked until 6 hours later.
     */
    block_rules?: Array<{
        platform: Platform
        /**
         * Default is `article`
         */
        task_type?: TaskType
        /**
         * The rule will apply to the specified sub-task types included, otherwise it will block nothing
         */
        sub_type?: Array<string>
        /**
         * Default is `none`
         * if always set, block_until will be ignored
         */
        block_type?: 'always' | 'none' | 'once' | 'once.media'

        /**
         * default is `6h`
         */
        block_until?: string
    }>
}

type SendTargetConfig<T extends SendTargetPlatformEnum = SendTargetPlatformEnum> = PlatformConfigMap[T]

interface SendTarget<T extends SendTargetPlatformEnum = SendTargetPlatformEnum> {
    platform: T
    /**
     * unique id for the target of the platform
     */
    id: string
    config: SendTargetConfig<T> & SendTargetCommonConfig
}

export { SendTargetPlatformEnum }

export type {
    SendTarget,
    SendTargetConfig,
    SendTargetCommonConfig,
    TaskConfig as SenderTaskConfig,
}

export * from './media'
