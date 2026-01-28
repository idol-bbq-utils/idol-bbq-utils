import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../schema/pg'
import type { PgAdapter, DbConfig } from './types'

export function createPgAdapter(url: string, config?: Partial<DbConfig>): PgAdapter {
    const poolSize = config?.poolSize ?? 10

    const client = postgres(url, {
        max: poolSize,
        idle_timeout: 20,
        connect_timeout: 10,
    })

    const db = drizzle(client, { schema })

    return {
        dialect: 'pg',
        db,
        schema,
        async close() {
            await client.end()
        },
    }
}
