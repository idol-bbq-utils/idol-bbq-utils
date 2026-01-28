import type { Article } from '@idol-bbq-utils/render/types'
import { Platform } from '@idol-bbq-utils/spider/types'
import type { SqliteAdapter, PgAdapter } from '../adapter/types'
import { createDbFacade } from '../facade'
import type * as sqliteSchema from '../schema/sqlite'
import type * as pgSchema from '../schema/pg'

export type ArticleWithId = Article & { id: number }

type DBArticle = typeof sqliteSchema.article.$inferSelect | typeof pgSchema.article.$inferSelect

export interface ArticleOperations {
    checkExist(article: Article): Promise<DBArticle | undefined>
    trySave(article: Article): Promise<DBArticle | undefined>
    save(article: Article): Promise<DBArticle>
    get(id: number): Promise<DBArticle | undefined>
    getByArticleCode(a_id: string, platform: Platform): Promise<DBArticle | undefined>
    getSingleArticle(id: number): Promise<ArticleWithId | undefined>
    getSingleArticleByArticleCode(a_id: string, platform: Platform): Promise<ArticleWithId | undefined>
    getArticlesByName(u_id: string, platform: Platform, count?: number): Promise<ArticleWithId[]>
}

export function createArticleOperations(adapter: SqliteAdapter): ArticleOperations
export function createArticleOperations(adapter: PgAdapter): ArticleOperations
export function createArticleOperations(adapter: SqliteAdapter | PgAdapter): ArticleOperations {
    const db = createDbFacade(adapter)
    const schema = adapter.schema

    async function checkExist(article: Article) {
        return await db.article.findFirst({
            where: (table, { and, eq }) => and(eq(table.a_id, article.a_id), eq(table.platform, article.platform)),
        })
    }

    async function trySave(article: Article): Promise<DBArticle | undefined> {
        const exist_one = await checkExist(article)
        if (exist_one) {
            return
        }
        return await save(article)
    }

    async function save(article: Article): Promise<DBArticle> {
        const exist_one = await checkExist(article)
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
                extra: article.extra ?? null,
                media: article.media ?? null,
            })
            .returning()
        return result[0]!
    }

    async function get(id: number) {
        return await db.article.findFirst({
            where: (table, { eq }) => eq(table.id, id),
        })
    }

    async function getByArticleCode(a_id: string, platform: Platform) {
        return await db.article.findFirst({
            where: (table, { and, eq }) => and(eq(table.a_id, a_id), eq(table.platform, platform)),
        })
    }

    async function getSingleArticle(id: number) {
        const article = await db.article.findFirst({
            where: (table, { eq }) => eq(table.id, id),
        })
        if (!article) {
            return
        }
        return await getFullChainArticle(article)
    }

    async function getSingleArticleByArticleCode(a_id: string, platform: Platform) {
        const article = await db.article.findFirst({
            where: (table, { and, eq }) => and(eq(table.a_id, a_id), eq(table.platform, platform)),
        })
        if (!article) {
            return
        }
        return await getFullChainArticle(article)
    }

    async function getFullChainArticle(article: DBArticle): Promise<ArticleWithId> {
        let currentRefId = article.ref
        let currentArticle = article as ArticleWithId
        while (currentRefId) {
            const foundArticle = await db.article.findFirst({
                where: (table, { eq }) => eq(table.id, currentRefId),
            })
            currentRefId = foundArticle?.ref || null
            currentArticle.ref = foundArticle as ArticleWithId
            currentArticle = foundArticle as ArticleWithId
        }
        return article as ArticleWithId
    }

    async function getArticlesByName(u_id: string, platform: Platform, count = 10) {
        const res = await db.article.findMany({
            where: (table, { and, eq }) => and(eq(table.platform, platform), eq(table.u_id, u_id)),
            orderBy: (table, { desc }) => [desc(table.created_at)],
            limit: count,
        })
        const articles = await Promise.all(res.map((item) => getSingleArticle(item.id)))
        return articles.filter((item) => item) as ArticleWithId[]
    }

    return {
        checkExist,
        trySave,
        save,
        get,
        getByArticleCode,
        getSingleArticle,
        getSingleArticleByArticleCode,
        getArticlesByName,
    }
}
