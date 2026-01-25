import type { SenderTaskConfig, SendTarget, SendTargetCommonConfig, Media } from "@idol-bbq-utils/sender"
import type { TaskType } from "@idol-bbq-utils/spider/types"
import type { CommonCfgConfig } from "@idol-bbq-utils/utils"

interface SenderConfig extends CommonCfgConfig {
    cron?: string
    media?: Media
    render_type?: 'text' | 'img' | 'img-with-meta'
}

interface Sender<T extends TaskType> {
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
     * Array of send target's id or id with runtime config, if empty will use all targets
     */
    targets?: Array<
        | string
        | {
              id: string
              cfg_send_target?: SendTargetCommonConfig
          }
    >
    
    config?: {
        /**
         *
         */
        cfg_task?: SenderTaskConfig<T>
        cfg_sender?: SenderConfig
        cfg_send_target?: SendTargetCommonConfig
    }
}

export type { Sender, SenderConfig }