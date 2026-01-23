import { Worker, type Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import type { CrawlerJobData, JobResult } from './jobs'
import { QueueName } from './index'

export interface CrawlerWorkerOptions {
    connection: ConnectionOptions
    concurrency?: number
    limiter?: {
        max: number
        duration: number
    }
}

export type CrawlerJobProcessor = (job: Job<CrawlerJobData>) => Promise<JobResult>

export function createCrawlerWorker(
    processor: CrawlerJobProcessor,
    options: CrawlerWorkerOptions,
): Worker<CrawlerJobData, JobResult> {
    const worker = new Worker<CrawlerJobData, JobResult>(
        QueueName.CRAWLER,
        async (job) => {
            return await processor(job)
        },
        {
            connection: options.connection,
            concurrency: options.concurrency ?? 5,
            limiter: options.limiter,
        },
    )

    return worker
}

export { Worker }
export type { Job }
