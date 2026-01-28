import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { DbDialect } from '../schema/types'
import * as sqliteSchema from '../schema/sqlite'
import * as pgSchema from '../schema/pg'

export type SqliteAdapter = {
    dialect: 'sqlite'
    db: BunSQLiteDatabase<typeof sqliteSchema>
    schema: typeof sqliteSchema
    close(): Promise<void>
}

export type PgAdapter = {
    dialect: 'pg'
    db: PostgresJsDatabase<typeof pgSchema>
    schema: typeof pgSchema
    close(): Promise<void>
}

export type DbAdapter = SqliteAdapter | PgAdapter

export type DrizzleDb = BunSQLiteDatabase<typeof sqliteSchema> | PostgresJsDatabase<typeof pgSchema>

export interface DbConfig {
    url: string
    poolSize?: number
}
