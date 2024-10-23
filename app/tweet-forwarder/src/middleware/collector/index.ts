import { Collector } from './base'
import { XCollector } from './x'

const collectorMap: Record<string, new () => Collector> = {
    'x.com': XCollector,
    'twitter.com': XCollector,
}

export function collectorFetcher(website: string): new () => Collector {
    const url = new URL(website)
    const collector = collectorMap[url.hostname]
    if (!collector) {
        throw new Error('Website not supported')
    }
    return collector
}
