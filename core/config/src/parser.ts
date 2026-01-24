import fs from 'fs'
import YAML from 'yaml'
import type { AppConfigType } from './types'

export function parseConfigFromFile(configPath: string): AppConfigType {
    try {
        const yamlContent = fs.readFileSync(configPath, 'utf8')
        const config = YAML.parse(yamlContent) as AppConfigType
        return config
    } catch (error) {
        throw new Error(`Failed to parse config file at ${configPath}: ${error}`)
    }
}

export function parseConfigFromString(yamlContent: string): AppConfigType {
    try {
        const config = YAML.parse(yamlContent) as AppConfigType
        return config
    } catch (error) {
        throw new Error(`Failed to parse config from string: ${error}`)
    }
}
