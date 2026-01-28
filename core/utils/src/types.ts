interface CommonCfgConfig {
    /**
     * Default the deeper level of configuration will override the upper level
     * But you can disable this behavior by setting `disable_overwrite` to `true`
     */
    disable_overwrite?: boolean
}

export type { CommonCfgConfig }
