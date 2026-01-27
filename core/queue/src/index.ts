import { Queue, Worker, QueueEvents, type ConnectionOptions, type JobsOptions } from 'bullmq'
import { Redis } from 'ioredis'
import { QueueName } from './worker'

export interface QueueConfig {
    redis: {
        host: string
        port: number
        password?: string
        db?: number
    }
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 1000,
    },
}

export class QueueManager {
    private connection: Redis
    private queues: Map<QueueName, Queue> = new Map()
    private connectionOptions: ConnectionOptions

    constructor(config: QueueConfig) {
        this.connection = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            maxRetriesPerRequest: null,
        })

        this.connectionOptions = {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
        }
    }

    getQueue(name: QueueName): Queue {
        if (!this.queues.has(name)) {
            const queue = new Queue(name, {
                connection: this.connectionOptions,
                defaultJobOptions: DEFAULT_JOB_OPTIONS,
            })
            this.queues.set(name, queue)
        }
        return this.queues.get(name)!
    }

    getConnection(): Redis {
        return this.connection
    }

    createQueueEvents(name: QueueName): QueueEvents {
        return new QueueEvents(name, {
            connection: this.connectionOptions,
        })
    }

    async close(): Promise<void> {
        await Promise.all(Array.from(this.queues.values()).map((q) => q.close()))
        await this.connection.quit()
    }
}

export { Queue, Worker, QueueEvents }
export type { ConnectionOptions, JobsOptions }
export * from './worker'
export * from './utils'
