import crypto from 'crypto'
import { CronJob } from 'cron'

/**
 * 根据 Cron 表达式推断任务的时间槽窗口（秒）
 * 目的：确保在同一个 Cron 执行周期内，生成的 Job ID 是相同的，从而实现分布式去重
 */
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

            /**
             * 窗口大小等于 Cron 执行间隔 (multiplier = 1)
             * 确保每次 Cron 触发时，都会进入一个新的时间槽
             */
            const slotWindow = intervalSeconds

            return Math.max(10, Math.min(3600, slotWindow))
        }
    } catch (error) {
        return 600
    }

    return 600
}

/**
 * 生成确定性的 Job ID
 * 算法：MD5(prefix + content + slot + window)
 * 只要在同一个时间窗口（slot）内，且任务内容一致，生成的 ID 就完全相同
 * BullMQ 会自动根据重复的 ID 进行去重，确保分布式环境下不重复调度
 */
export function generateJobId(prefix: string, content: string, cron?: string): string {
    const slotWindowSeconds = inferSlotWindowSeconds(cron)
    const slot = Math.floor(Date.now() / (slotWindowSeconds * 1000))

    // 使用 MD5 生成哈希，并截断为前 12 位
    // 12 位 16 进制 (48 bits) 在单次调度周期内具有极高的唯一性，且在日志中更易读
    return crypto
        .createHash('md5')
        .update(`${prefix}:${content}:${slot}:${slotWindowSeconds}`)
        .digest('hex')
        .substring(0, 12)
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
