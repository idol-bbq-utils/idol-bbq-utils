import { Platform } from '@idol-bbq-utils/spider/types'
import type { GenericFollows } from '@idol-bbq-utils/spider/types'
import { db, schema } from './client'
import { getSubtractTime } from '@idol-bbq-utils/utils'
import type { Article } from '@idol-bbq-utils/render/types'
import { spiderRegistry } from '@idol-bbq-utils/spider'
import { eq, and, desc, lte, inArray } from 'drizzle-orm'

export { ensureMigrations } from './migrate'

type ArticleWithId = Article & { id: number }

type DBArticle = typeof schema.article.$inferSelect
type DBFollows = typeof schema.follow.$inferSelect

namespace DB {
    export namespace Article {
        export async function checkExist(article: Article) {
            return await db
                .select()
                .from(schema.article)
                .where(and(eq(schema.article.a_id, article.a_id), eq(schema.article.platform, article.platform)))
                .get()
        }

        export async function trySave(article: Article): Promise<DBArticle | undefined> {
            let exist_one = await checkExist(article)
            if (exist_one) {
                return
            }
            return await save(article)
        }

        export async function save(article: Article): Promise<DBArticle> {
            let exist_one = await checkExist(article)
            if (exist_one) {
                return exist_one
            }
            let ref: number | undefined = undefined
            if (article.ref) {
                if (typeof article.ref === 'object') {
                    ref = (await save(article.ref)).id
                }
                if (typeof article.ref === 'string') {
                    const refArticle = await getByArticleCode(article.ref, article.platform)
                    ref = refArticle?.id
                }
            }
            const result = await db
                .insert(schema.article)
                .values({
                    ...article,
                    ref: ref,
                    extra: article.extra ? (article.extra as any) : null,
                    media: (article.media as any) ?? null,
                })
                .returning()
            return result[0]!
        }

        export async function get(id: number) {
            return await db.select().from(schema.article).where(eq(schema.article.id, id)).get()
        }

        export async function getByArticleCode(a_id: string, platform: Platform) {
            return await db
                .select()
                .from(schema.article)
                .where(and(eq(schema.article.a_id, a_id), eq(schema.article.platform, platform)))
                .get()
        }

        export async function getSingleArticle(id: number) {
            const article = await db.select().from(schema.article).where(eq(schema.article.id, id)).get()
            if (!article) {
                return
            }
            return await getFullChainArticle(article)
        }

        export async function getSingleArticleByArticleCode(a_id: string, platform: Platform) {
            const article = await db
                .select()
                .from(schema.article)
                .where(and(eq(schema.article.a_id, a_id), eq(schema.article.platform, platform)))
                .get()
            if (!article) {
                return
            }
            return await getFullChainArticle(article)
        }

        async function getFullChainArticle(article: DBArticle) {
            let currentRefId = article.ref
            let currentArticle = article as unknown as ArticleWithId
            while (currentRefId) {
                const foundArticle = await db
                    .select()
                    .from(schema.article)
                    .where(eq(schema.article.id, currentRefId))
                    .get()
                currentRefId = foundArticle?.ref || null
                currentArticle.ref = foundArticle as unknown as ArticleWithId
                currentArticle = foundArticle as unknown as ArticleWithId
            }
            return article as unknown as ArticleWithId
        }

        export async function getArticlesByName(u_id: string, platform: Platform, count = 10) {
            const res = await db
                .select()
                .from(schema.article)
                .where(and(eq(schema.article.platform, platform), eq(schema.article.u_id, u_id)))
                .orderBy(desc(schema.article.created_at))
                .limit(count)
                .all()
            const articles = await Promise.all(res.map(async (item) => getSingleArticle(item.id)))
            return articles.filter((item) => item) as ArticleWithId[]
        }
    }

    export namespace Follow {
        export async function save(follows: GenericFollows) {
            const [result] = await db
                .insert(schema.follow)
                .values({
                    ...follows,
                    created_at: Math.floor(Date.now() / 1000),
                })
                .returning()
            return result
        }

        export async function getLatestAndComparisonFollowsByName(
            u_id: string,
            platform: Platform,
            window: string,
        ): Promise<[DBFollows, DBFollows | null] | null> {
            const latest = await db
                .select()
                .from(schema.follow)
                .where(and(eq(schema.follow.platform, platform), eq(schema.follow.u_id, u_id)))
                .orderBy(desc(schema.follow.created_at))
                .limit(1)
                .get()
            if (!latest) {
                return null
            }
            const latestTime = latest.created_at
            const subtractTime = getSubtractTime(latestTime, window)
            const comparison = await db
                .select()
                .from(schema.follow)
                .where(
                    and(
                        eq(schema.follow.platform, platform),
                        eq(schema.follow.u_id, u_id),
                        lte(schema.follow.created_at, subtractTime),
                    ),
                )
                .orderBy(desc(schema.follow.created_at))
                .limit(1)
                .get()
            return [latest, comparison || null]
        }
    }

    export namespace SendBy {
        export async function checkExist(ref_id: number, sender_id: string, task_type: string) {
            return await db
                .select()
                .from(schema.sendBy)
                .where(
                    and(
                        eq(schema.sendBy.ref_id, ref_id),
                        eq(schema.sendBy.sender_id, sender_id),
                        eq(schema.sendBy.task_type, task_type),
                    ),
                )
                .get()
        }

        export async function batchCheckExist(articleIds: number[], targetIds: string[], taskType: string) {
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
                .all()
        }

        export async function save(ref_id: number, sender_id: string, task_type: string) {
            let exist_one = await checkExist(ref_id, sender_id, task_type)
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
            return result
        }

        export async function deleteRecord(ref_id: number, sender_id: string, task_type: string) {
            let exist_one = await checkExist(ref_id, sender_id, task_type)
            if (!exist_one) {
                return
            }
            return await db
                .delete(schema.sendBy)
                .where(
                    and(
                        eq(schema.sendBy.ref_id, ref_id),
                        eq(schema.sendBy.sender_id, sender_id),
                        eq(schema.sendBy.task_type, task_type),
                    ),
                )
                .returning()
                .then((rows) => rows[0])
        }

        export async function queryPendingArticleIds(websites: string[], sender_ids: string[]): Promise<number[]> {
            const articleIdsSet: Set<number> = new Set()
            const targets = sender_ids

            for (const website of websites) {
                const { u_id, platform } = spiderRegistry.extractBasicInfo(website) ?? {}
                if (!u_id || !platform) continue

                const articles = await DB.Article.getArticlesByName(u_id, platform)
                if (articles.length === 0) continue

                const articleIdList = articles.map((a) => a.id)

                const forwardedRecords = await DB.SendBy.batchCheckExist(articleIdList, targets, 'article')

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
    }
}

export default DB
export type { Article, ArticleWithId, DBFollows }
