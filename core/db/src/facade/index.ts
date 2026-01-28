/**
 * Database Facade
 *
 * This facade provides a type-safe, dialect-agnostic interface for database operations.
 * It hides the union type complexity of BunSQLiteDatabase | PostgresJsDatabase behind
 * a single stable interface.
 *
 * Background: TypeScript cannot unify union types with incompatible callable signatures.
 * Even with intersection types like `& { query: SharedQuery }`, the original union remains
 * visible to the type checker, causing "not callable" errors.
 *
 * Solution: Runtime dispatch based on adapter.dialect, with a single return type.
 */

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { SQL } from 'drizzle-orm'
import type { SqliteAdapter, PgAdapter } from '../adapter/types'
import * as sqliteSchema from '../schema/sqlite'
import * as pgSchema from '../schema/pg'

type SchemaTable =
    | typeof sqliteSchema.article
    | typeof sqliteSchema.follow
    | typeof sqliteSchema.sendBy
    | typeof sqliteSchema.sqliteAccount
    | typeof pgSchema.article
    | typeof pgSchema.follow
    | typeof pgSchema.sendBy
    | typeof pgSchema.pgAccount

type InferInsert<T> = T extends typeof sqliteSchema.article
    ? typeof sqliteSchema.article.$inferInsert
    : T extends typeof sqliteSchema.follow
      ? typeof sqliteSchema.follow.$inferInsert
      : T extends typeof sqliteSchema.sendBy
        ? typeof sqliteSchema.sendBy.$inferInsert
        : T extends typeof sqliteSchema.sqliteAccount
          ? typeof sqliteSchema.sqliteAccount.$inferInsert
          : T extends typeof pgSchema.article
            ? typeof pgSchema.article.$inferInsert
            : T extends typeof pgSchema.follow
              ? typeof pgSchema.follow.$inferInsert
              : T extends typeof pgSchema.sendBy
                ? typeof pgSchema.sendBy.$inferInsert
                : T extends typeof pgSchema.pgAccount
                  ? typeof pgSchema.pgAccount.$inferInsert
                  : never

type InferSelect<T> = T extends typeof sqliteSchema.article
    ? typeof sqliteSchema.article.$inferSelect
    : T extends typeof sqliteSchema.follow
      ? typeof sqliteSchema.follow.$inferSelect
      : T extends typeof sqliteSchema.sendBy
        ? typeof sqliteSchema.sendBy.$inferSelect
        : T extends typeof sqliteSchema.sqliteAccount
          ? typeof sqliteSchema.sqliteAccount.$inferSelect
          : T extends typeof pgSchema.article
            ? typeof pgSchema.article.$inferSelect
            : T extends typeof pgSchema.follow
              ? typeof pgSchema.follow.$inferSelect
              : T extends typeof pgSchema.sendBy
                ? typeof pgSchema.sendBy.$inferSelect
                : T extends typeof pgSchema.pgAccount
                  ? typeof pgSchema.pgAccount.$inferSelect
                  : never

type WhereCallback<TTable> = (
    table: TTable,
    helpers: {
        eq: (left: unknown, right: unknown) => SQL<unknown>
        and: (...conditions: (SQL<unknown> | undefined)[]) => SQL<unknown> | undefined
        lte: (left: unknown, right: unknown) => SQL<unknown>
    },
) => SQL<unknown> | undefined

type OrderByCallback<TTable> = (
    table: TTable,
    helpers: { desc: (column: unknown) => SQL<unknown>; asc: (column: unknown) => SQL<unknown> },
) => SQL<unknown>[]

export interface InsertBuilder<TTable extends SchemaTable> {
    values(values: InferInsert<TTable>): ReturningBuilder<TTable>
}

export interface ReturningBuilder<TTable extends SchemaTable> {
    returning(): Promise<InferSelect<TTable>[]>
}

export interface DeleteBuilder<TTable extends SchemaTable> {
    where(condition: SQL<unknown> | undefined): DeleteReturningBuilder<TTable>
}

export interface DeleteReturningBuilder<TTable extends SchemaTable> {
    returning(): Promise<InferSelect<TTable>[]>
}

export interface UpdateBuilder<TTable extends SchemaTable> {
    set(values: Partial<InferInsert<TTable>>): UpdateWhereBuilder<TTable>
}

export interface UpdateWhereBuilder<TTable extends SchemaTable> {
    where(condition: SQL<unknown> | undefined): UpdateReturningBuilder<TTable>
}

export interface UpdateReturningBuilder<TTable extends SchemaTable> {
    returning(): Promise<InferSelect<TTable>[]>
}

export interface SelectBuilder {
    from<TTable extends SchemaTable>(table: TTable): SelectFromBuilder<TTable>
}

export interface SelectFromBuilder<TTable extends SchemaTable> {
    where(condition: SQL<unknown> | undefined): Promise<InferSelect<TTable>[]>
}

export interface ArticleQuery {
    findFirst(config?: {
        where?: WhereCallback<typeof sqliteSchema.article | typeof pgSchema.article>
        orderBy?: OrderByCallback<typeof sqliteSchema.article | typeof pgSchema.article>
    }): Promise<(typeof sqliteSchema.article.$inferSelect | typeof pgSchema.article.$inferSelect) | undefined>

    findMany(config?: {
        where?: WhereCallback<typeof sqliteSchema.article | typeof pgSchema.article>
        orderBy?: OrderByCallback<typeof sqliteSchema.article | typeof pgSchema.article>
        limit?: number
    }): Promise<Array<typeof sqliteSchema.article.$inferSelect | typeof pgSchema.article.$inferSelect>>
}

export interface FollowQuery {
    findFirst(config?: {
        where?: WhereCallback<typeof sqliteSchema.follow | typeof pgSchema.follow>
        orderBy?: OrderByCallback<typeof sqliteSchema.follow | typeof pgSchema.follow>
    }): Promise<(typeof sqliteSchema.follow.$inferSelect | typeof pgSchema.follow.$inferSelect) | undefined>
}

export interface SendByQuery {
    findFirst(config?: {
        where?: WhereCallback<typeof sqliteSchema.sendBy | typeof pgSchema.sendBy>
        orderBy?: OrderByCallback<typeof sqliteSchema.sendBy | typeof pgSchema.sendBy>
    }): Promise<(typeof sqliteSchema.sendBy.$inferSelect | typeof pgSchema.sendBy.$inferSelect) | undefined>
}

export interface AccountQuery {
    findFirst(config?: {
        where?: WhereCallback<typeof sqliteSchema.sqliteAccount | typeof pgSchema.pgAccount>
        orderBy?: OrderByCallback<typeof sqliteSchema.sqliteAccount | typeof pgSchema.pgAccount>
    }): Promise<(typeof sqliteSchema.sqliteAccount.$inferSelect | typeof pgSchema.pgAccount.$inferSelect) | undefined>

    findMany(config?: {
        where?: WhereCallback<typeof sqliteSchema.sqliteAccount | typeof pgSchema.pgAccount>
        orderBy?: OrderByCallback<typeof sqliteSchema.sqliteAccount | typeof pgSchema.pgAccount>
        limit?: number
    }): Promise<Array<typeof sqliteSchema.sqliteAccount.$inferSelect | typeof pgSchema.pgAccount.$inferSelect>>
}

export interface DbQueryFacade {
    article: ArticleQuery
    follow: FollowQuery
    sendBy: SendByQuery
    account: AccountQuery
}

export interface DbFacade extends DbQueryFacade {
    insert<TTable extends SchemaTable>(table: TTable): InsertBuilder<TTable>
    update<TTable extends SchemaTable>(table: TTable): UpdateBuilder<TTable>
    delete<TTable extends SchemaTable>(table: TTable): DeleteBuilder<TTable>
    select(fields: Record<string, unknown>): SelectBuilder
}

function createSqliteFacade(db: BunSQLiteDatabase<typeof sqliteSchema>): DbFacade {
    return {
        article: {
            findFirst: async (config) => await db.query.article.findFirst(config as any),
            findMany: async (config) => await db.query.article.findMany(config as any),
        },
        follow: {
            findFirst: async (config) => await db.query.follow.findFirst(config as any),
        },
        sendBy: {
            findFirst: async (config) => await db.query.sendBy.findFirst(config as any),
        },
        account: {
            findFirst: async (config) => await db.query.sqliteAccount.findFirst(config as any),
            findMany: async (config) => await db.query.sqliteAccount.findMany(config as any),
        },
        insert: (table) => {
            const builder = db.insert(table as any)
            return {
                values: (values) => {
                    const valuesBuilder = builder.values(values as any)
                    return {
                        returning: async () => (await valuesBuilder.returning()) as any,
                    }
                },
            }
        },
        update: (table) => {
            const builder = db.update(table as any)
            return {
                set: (values) => {
                    const setBuilder = builder.set(values as any)
                    return {
                        where: (condition) => {
                            const whereBuilder = setBuilder.where(condition as any)
                            return {
                                returning: async () => (await whereBuilder.returning()) as any,
                            }
                        },
                    }
                },
            }
        },
        delete: (table) => {
            const builder = db.delete(table as any)
            return {
                where: (condition) => {
                    const whereBuilder = builder.where(condition as any)
                    return {
                        returning: async () => (await whereBuilder.returning()) as any,
                    }
                },
            }
        },
        select: (fields) => {
            const builder = db.select(fields as any)
            return {
                from: (table) => {
                    const fromBuilder = builder.from(table as any)
                    return {
                        where: async (condition) => (await fromBuilder.where(condition as any)) as any,
                    }
                },
            }
        },
    }
}

function createPgFacade(db: PostgresJsDatabase<typeof pgSchema>): DbFacade {
    return {
        article: {
            findFirst: async (config) => await db.query.article.findFirst(config as any),
            findMany: async (config) => await db.query.article.findMany(config as any),
        },
        follow: {
            findFirst: async (config) => await db.query.follow.findFirst(config as any),
        },
        sendBy: {
            findFirst: async (config) => await db.query.sendBy.findFirst(config as any),
        },
        account: {
            findFirst: async (config) => await db.query.pgAccount.findFirst(config as any),
            findMany: async (config) => await db.query.pgAccount.findMany(config as any),
        },
        insert: (table) => {
            const builder = db.insert(table as any)
            return {
                values: (values) => {
                    const valuesBuilder = builder.values(values as any)
                    return {
                        returning: async () => (await valuesBuilder.returning()) as any,
                    }
                },
            }
        },
        update: (table) => {
            const builder = db.update(table as any)
            return {
                set: (values) => {
                    const setBuilder = builder.set(values as any)
                    return {
                        where: (condition) => {
                            const whereBuilder = setBuilder.where(condition as any)
                            return {
                                returning: async () => (await whereBuilder.returning()) as any,
                            }
                        },
                    }
                },
            }
        },
        delete: (table) => {
            const builder = db.delete(table as any)
            return {
                where: (condition) => {
                    const whereBuilder = builder.where(condition as any)
                    return {
                        returning: async () => (await whereBuilder.returning()) as any,
                    }
                },
            }
        },
        select: (fields) => {
            const builder = db.select(fields as any)
            return {
                from: (table) => {
                    const fromBuilder = builder.from(table as any)
                    return {
                        where: async (condition) => (await fromBuilder.where(condition as any)) as any,
                    }
                },
            }
        },
    }
}

export function createDbFacade(adapter: SqliteAdapter | PgAdapter): DbFacade {
    if (adapter.dialect === 'sqlite') {
        return createSqliteFacade(adapter.db as BunSQLiteDatabase<typeof sqliteSchema>)
    } else {
        return createPgFacade(adapter.db as PostgresJsDatabase<typeof pgSchema>)
    }
}
