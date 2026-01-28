
import { CronJob } from 'cron'
import { Logger } from '@idol-bbq-utils/log'
import { BaseCompatibleModel } from '@idol-bbq-utils/utils'

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
        protected tasks: Map<string, Task> = new Map()
        protected cronJobs: Array<CronJob> = []
        protected taskHandlers: Record<Exclude<TaskEvent, TaskEvent.DISPATCH>, (...args: any[]) => void>

        constructor() {
            super()
            this.taskHandlers = {
                [TaskEvent.UPDATE_STATUS]: this.updateTaskStatus.bind(this),
                [TaskEvent.FINISHED]: this.finishTask.bind(this),
            }
        }
        abstract start(...args: any[]): Promise<void>
        abstract stop(...args: any[]): Promise<void>
        abstract drop(...args: any[]): Promise<void>
        abstract updateTaskStatus(...args: any[]): void
        abstract finishTask(...args: any[]): void
    }
}

export { TaskScheduler }
