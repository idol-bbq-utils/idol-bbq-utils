import { Worker, type Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import type { CrawlerJobData, SenderJobData, JobResult } from './jobs'

export enum QueueName {
    CRAWLER = 'crawler',
    STORAGE = 'storage',
    SENDER = 'sender',
}

export interface CrawlerWorkerOptions {
    connection: ConnectionOptions
    concurrency?: number
    limiter?: {
        max: number
        duration: number
    }
}

export interface SenderWorkerOptions {
    connection: ConnectionOptions
    concurrency?: number
    limiter?: {
        max: number
        duration: number
    }
}

export type CrawlerJobProcessor = (job: Job<CrawlerJobData>) => Promise<JobResult>
export type SenderJobProcessor = (job: Job<SenderJobData>) => Promise<JobResult>

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

export function createSenderWorker(
    processor: SenderJobProcessor,
    options: SenderWorkerOptions,
): Worker<SenderJobData, JobResult> {
    const worker = new Worker<SenderJobData, JobResult>(
        QueueName.SENDER,
        async (job) => {
            return await processor(job)
        },
        {
            connection: options.connection,
            concurrency: options.concurrency ?? 3,
            limiter: options.limiter,
        },
    )

    return worker
}

export { Worker }
export type { Job }
