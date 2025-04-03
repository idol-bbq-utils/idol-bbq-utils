import { Logger } from '@idol-bbq-utils/log'
import { CronJob } from 'cron'
import { EventEmitter } from 'events'

interface Droppable {
    drop(...args: any[]): Promise<void>
}

abstract class BaseCompatibleModel implements Droppable {
    abstract NAME: string
    protected abstract log?: Logger

    abstract init(...args: any[]): Promise<void>
    abstract drop(...args: any[]): Promise<void>
}

namespace TaskScheduler {
    export enum TaskStatus {
        PENDING = 'pending',
        RUNNING = 'running',
        COMPLETED = 'completed',
        CANCELLED = 'cancelled',
        FAILED = 'failed',
    }

    export interface Task {
        id: string
        status: TaskStatus
        data: any
    }

    export interface TaskCtx {
        taskId: string
        task: Task
        log?: Logger
    }

    export enum TaskEvent {
        DISPATCH = 'task:dispatch',
        UPDATE_STATUS = 'task:update-status',
        FINISHED = 'task:finished',
    }
    export abstract class TaskScheduler extends BaseCompatibleModel {
        protected emitter: EventEmitter
        protected tasks: Map<string, Task> = new Map()
        protected cronJobs: Array<CronJob> = []
        protected taskHandlers: Record<Exclude<TaskEvent, TaskEvent.DISPATCH>, (...args: any[]) => void>

        constructor(emitter: EventEmitter) {
            super()
            this.taskHandlers = {
                [TaskEvent.UPDATE_STATUS]: this.updateTaskStatus.bind(this),
                [TaskEvent.FINISHED]: this.finishTask.bind(this),
            }
            this.emitter = emitter
        }
        abstract start(...args: any[]): Promise<void>
        abstract stop(...args: any[]): Promise<void>
        abstract drop(...args: any[]): Promise<void>
        abstract updateTaskStatus(...args: any[]): void
        abstract finishTask(...args: any[]): void
    }
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
    if (websites) {
        return websites
    }
    if (origin) {
        if (paths && paths.length > 0) {
            return paths.map((p) => `${origin.replace(/\/$/, '')}/${p.replace(/^\//, '')}`)
        }
    }
    return []
}

export { TaskScheduler, BaseCompatibleModel, sanitizeWebsites }
