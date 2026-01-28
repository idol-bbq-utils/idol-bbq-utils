import type { GenericFollows } from '@idol-bbq-utils/spider/types'
import { Platform } from '@idol-bbq-utils/spider/types'
import { getSubtractTime } from '@idol-bbq-utils/utils'
import type { SqliteAdapter, PgAdapter } from '../adapter/types'
import { createDbFacade } from '../facade'
import type * as sqliteSchema from '../schema/sqlite'
import type * as pgSchema from '../schema/pg'

type DBFollow = typeof sqliteSchema.follow.$inferSelect | typeof pgSchema.follow.$inferSelect

export type DBFollows = DBFollow

export interface FollowOperations {
    save(follows: GenericFollows): Promise<DBFollow>
    getLatestAndComparisonFollowsByName(
        u_id: string,
        platform: Platform,
        window: string,
    ): Promise<[DBFollow, DBFollow | null] | null>
}

export function createFollowOperations(adapter: SqliteAdapter): FollowOperations
export function createFollowOperations(adapter: PgAdapter): FollowOperations
export function createFollowOperations(adapter: SqliteAdapter | PgAdapter): FollowOperations {
    const db = createDbFacade(adapter)
    const schema = adapter.schema

    async function save(follows: GenericFollows) {
        const [result] = await db
            .insert(schema.follow)
            .values({
                ...follows,
                created_at: Math.floor(Date.now() / 1000),
            })
            .returning()
        return result!
    }

    async function getLatestAndComparisonFollowsByName(
        u_id: string,
        platform: Platform,
        window: string,
    ): Promise<[DBFollow, DBFollow | null] | null> {
        const latest = await db.follow.findFirst({
            where: (table, { and, eq }) => and(eq(table.platform, platform), eq(table.u_id, u_id)),
            orderBy: (table, { desc }) => [desc(table.created_at)],
        })
        if (!latest) {
            return null
        }
        const latestTime = latest.created_at
        const subtractTime = getSubtractTime(latestTime, window)
        const comparison = await db.follow.findFirst({
            where: (table, { and, eq, lte }) =>
                and(eq(table.platform, platform), eq(table.u_id, u_id), lte(table.created_at, subtractTime)),
            orderBy: (table, { desc }) => [desc(table.created_at)],
        })
        return [latest, comparison || null]
    }

    return {
        save,
        getLatestAndComparisonFollowsByName,
    }
}
