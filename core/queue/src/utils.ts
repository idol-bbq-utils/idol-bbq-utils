import crypto from 'crypto'
import { CronJob } from 'cron'

function inferSlotWindowSeconds(cron?: string): number {
    if (!cron) return 600

    try {
        const job = new CronJob(cron, () => {})
        const nextDates = job.nextDates(2)

        if (nextDates && nextDates.length >= 2) {
            const date1 = nextDates[0]!.toJSDate()
            const date2 = nextDates[1]!.toJSDate()
            const intervalMs = date2.getTime() - date1.getTime()
            const intervalSeconds = Math.floor(intervalMs / 1000)

            const slotWindow = intervalSeconds * 2
            return Math.max(30, Math.min(3600, slotWindow))
        }
    } catch (error) {
        return 600
    }

    return 600
}

export function generateJobId(prefix: string, content: string, cron?: string): string {
    const slotWindowSeconds = inferSlotWindowSeconds(cron)
    const slot = Math.floor(Date.now() / (slotWindowSeconds * 1000))

    return crypto.createHash('md5').update(`${prefix}:${content}:${slot}:${slotWindowSeconds}`).digest('hex')
}

export function getLockKey(prefix: string, taskName: string): string {
    return `scheduler:lock:${prefix}:${taskName}`
}

export async function acquireLock(
    redis: any,
    lockKey: string,
    lockValue: string,
    ttlSeconds: number = 60,
): Promise<boolean> {
    const result = await redis.set(lockKey, lockValue, 'NX', 'EX', ttlSeconds)
    return result === 'OK'
}

export async function releaseLock(redis: any, lockKey: string, lockValue: string): Promise<void> {
    const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `
    await redis.eval(script, 1, lockKey, lockValue)
}
