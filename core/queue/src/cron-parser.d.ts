declare module 'cron-parser' {
    export interface CronExpression {
        next(): CronDate
        prev(): CronDate
        hasNext(): boolean
        hasPrev(): boolean
        reset(): void
    }

    export interface CronDate {
        toDate(): Date
        toString(): string
    }

    export interface ParseOptions {
        currentDate?: Date | string | number
        startDate?: Date | string | number
        endDate?: Date | string | number
        iterator?: boolean
        utc?: boolean
        tz?: string
    }

    export function parseExpression(expression: string, options?: ParseOptions): CronExpression

    export default {
        parseExpression,
    }
}
