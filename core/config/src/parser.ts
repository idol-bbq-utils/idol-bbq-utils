import fs from 'fs'
import YAML from 'yaml'
import type { AppConfig } from './types'

export function parseConfigFromFile(configPath: string): AppConfig {
    try {
        const yamlContent = fs.readFileSync(configPath, 'utf8')
        const config = YAML.parse(yamlContent) as AppConfig
        return config
    } catch (error) {
        throw new Error(`Failed to parse config file at ${configPath}: ${error}`)
    }
}

export function parseConfigFromString(yamlContent: string): AppConfig {
    try {
        const config = YAML.parse(yamlContent) as AppConfig
        return config
    } catch (error) {
        throw new Error(`Failed to parse config from string: ${error}`)
    }
}
