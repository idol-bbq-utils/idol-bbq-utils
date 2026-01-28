export * from './p-retry'
export * from './is-network-error'
export * from './media'
export * from './time'
export * from './directories'
export * from './types'

import { Logger } from '@idol-bbq-utils/log'
import { uniq } from 'lodash'

interface Droppable {
    drop(...args: any[]): Promise<void>
}

abstract class BaseCompatibleModel implements Droppable {
    abstract NAME: string
    protected abstract log?: Logger

    abstract init(...args: any[]): Promise<void>
    abstract drop(...args: any[]): Promise<void>
}
/**
 * Sanitize websites, origin and paths to a list of websites.
 *
 * return websites if provided, otherwise return a list of websites constructed from origin and paths.
 */
function sanitizeWebsites({
    websites,
    origin,
    paths,
}: {
    websites?: Array<string>
    origin?: string
    paths?: Array<string>
}): Array<string> {
    let res = [] as Array<string>
    if (websites) {
        res = res.concat(websites)
    }
    if (origin) {
        if (paths && paths.length > 0) {
            res = res.concat(paths.map((p) => `${origin.replace(/\/$/, '')}/${p.replace(/^\//, '')}`))
        }
    }
    return uniq(res)
}

export { BaseCompatibleModel, sanitizeWebsites }