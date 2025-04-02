import { Logger } from '@idol-bbq-utils/log'
import { CronJob } from 'cron'
import { EventEmitter } from 'events'
import crypto from 'crypto'

abstract class BaseCompatibleModel {
    abstract NAME: string
    protected abstract log?: Logger

    abstract init(...args: any[]): Promise<void>
}

interface Droppable {
    drop(...args: any[]): Promise<void>
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

    export enum TaskEvent {
        DISPATCH = 'task:dispatch',
        UPDATE_STATUS = 'task:update-status',
        FINISHED = 'task:finished',
    }
    export abstract class TaskScheduler extends BaseCompatibleModel implements Droppable {
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

export { TaskScheduler, BaseCompatibleModel }
export type { Droppable }
