import { spiderRegistry } from '@idol-bbq-utils/spider'
import { eq, and, inArray } from 'drizzle-orm'
import type { SqliteAdapter, PgAdapter } from '../adapter/types'
import { createDbFacade } from '../facade'
import type { ArticleOperations } from './article'
import type * as sqliteSchema from '../schema/sqlite'
import type * as pgSchema from '../schema/pg'

type DBSendBy = typeof sqliteSchema.sendBy.$inferSelect | typeof pgSchema.sendBy.$inferSelect

export interface SendByOperations {
    checkExist(ref_id: number, sender_id: string, task_type: string): Promise<DBSendBy | undefined>
    batchCheckExist(
        articleIds: number[],
        targetIds: string[],
        taskType: string,
    ): Promise<Array<{ ref_id: number; sender_id: string }>>
    save(ref_id: number, sender_id: string, task_type: string): Promise<DBSendBy>
    deleteRecord(ref_id: number, sender_id: string, task_type: string): Promise<DBSendBy | undefined>
    queryPendingArticleIds(websites: string[], sender_ids: string[]): Promise<number[]>
}

export function createSendByOperations(adapter: SqliteAdapter, articleOps: ArticleOperations): SendByOperations
export function createSendByOperations(adapter: PgAdapter, articleOps: ArticleOperations): SendByOperations
export function createSendByOperations(
    adapter: SqliteAdapter | PgAdapter,
    articleOps: ArticleOperations,
): SendByOperations {
    const db = createDbFacade(adapter)
    const schema = adapter.schema

    async function checkExist(ref_id: number, sender_id: string, task_type: string) {
        return await db.sendBy.findFirst({
            where: (table, { and, eq }) =>
                and(eq(table.ref_id, ref_id), eq(table.sender_id, sender_id), eq(table.task_type, task_type)),
        })
    }

    async function batchCheckExist(articleIds: number[], targetIds: string[], taskType: string) {
        return await db
            .select({ ref_id: schema.sendBy.ref_id, sender_id: schema.sendBy.sender_id })
            .from(schema.sendBy)
            .where(
                and(
                    inArray(schema.sendBy.ref_id, articleIds),
                    inArray(schema.sendBy.sender_id, targetIds),
                    eq(schema.sendBy.task_type, taskType),
                ),
            )
    }

    async function save(ref_id: number, sender_id: string, task_type: string) {
        const exist_one = await checkExist(ref_id, sender_id, task_type)
        if (exist_one) {
            return exist_one
        }
        const [result] = await db
            .insert(schema.sendBy)
            .values({
                ref_id,
                sender_id,
                task_type,
            })
            .returning()
        return result!
    }

    async function deleteRecord(ref_id: number, sender_id: string, task_type: string) {
        const exist_one = await checkExist(ref_id, sender_id, task_type)
        if (!exist_one) {
            return
        }
        const rows = await db
            .delete(schema.sendBy)
            .where(
                and(
                    eq(schema.sendBy.ref_id, ref_id),
                    eq(schema.sendBy.sender_id, sender_id),
                    eq(schema.sendBy.task_type, task_type),
                ),
            )
            .returning()
        return rows[0]
    }

    async function queryPendingArticleIds(websites: string[], sender_ids: string[]): Promise<number[]> {
        const articleIdsSet: Set<number> = new Set()
        const targets = sender_ids

        for (const website of websites) {
            const { u_id, platform } = spiderRegistry.extractBasicInfo(website) ?? {}
            if (!u_id || !platform) continue

            const articles = await articleOps.getArticlesByName(u_id, platform)
            if (articles.length === 0) continue

            const articleIdList = articles.map((a) => a.id)

            const forwardedRecords = await batchCheckExist(articleIdList, targets, 'article')

            const forwardedMap = new Map<number, Set<string>>()
            for (const record of forwardedRecords) {
                if (!forwardedMap.has(record.ref_id)) {
                    forwardedMap.set(record.ref_id, new Set())
                }
                forwardedMap.get(record.ref_id)!.add(record.sender_id)
            }

            for (const article of articles) {
                const forwardedTargets = forwardedMap.get(article.id) || new Set()
                const needsForwarding = targets.some((t) => !forwardedTargets.has(t))
                if (needsForwarding) {
                    articleIdsSet.add(article.id)
                }
            }
        }

        return Array.from(articleIdsSet)
    }

    return {
        checkExist,
        batchCheckExist,
        save,
        deleteRecord,
        queryPendingArticleIds,
    }
}
