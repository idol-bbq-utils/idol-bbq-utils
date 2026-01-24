import type { Platform, TaskType } from '@idol-bbq-utils/spider/types'
import type { CommonCfgConfig } from './common'
import type { Media } from './media'

enum ForwardTargetPlatformEnum {
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
    /**
     * one11 bot protocol
     */
    [ForwardTargetPlatformEnum.QQ]: {
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

interface ForwardTargetPlatformCommonConfig {
    replace_regex?: string | [string, string] | Array<[string, string]>
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

type ForwardTargetPlatformConfig<T extends ForwardTargetPlatformEnum = ForwardTargetPlatformEnum> = PlatformConfigMap[T]

interface ForwarderConfig extends CommonCfgConfig {
    cron?: string
    media?: Media
    render_type?: 'text' | 'img' | 'img-with-meta'
}

interface ForwardTarget<T extends ForwardTargetPlatformEnum = ForwardTargetPlatformEnum> {
    platform: T
    /**
     * unique id for the target
     * default is md5 hash of the platform and config
     */
    id?: string
    cfg_platform: ForwardTargetPlatformConfig<T> & ForwardTargetPlatformCommonConfig
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
     * Array of forwarder target's id or id with runtime config, if empty will use all targets
     */
    subscribers?: Array<
        | string
        | {
              id: string
              cfg_forward_target?: ForwardTargetPlatformCommonConfig
          }
    >

    cfg_forwarder?: ForwarderConfig

    cfg_forward_target?: ForwardTargetPlatformCommonConfig
}

export { ForwardTargetPlatformEnum }

export type {
    ForwardTarget,
    Forwarder,
    ForwarderConfig,
    ForwardTargetPlatformConfig,
    ForwardTargetPlatformCommonConfig,
}
