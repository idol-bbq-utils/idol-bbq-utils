import { createSqliteAdapter } from './sqlite.adapter'
import { createPgAdapter } from './pg.adapter'
import type { DbAdapter, DbConfig, SqliteAdapter, PgAdapter } from './types'

let defaultAdapter: DbAdapter | null = null

export function getDbAdapter(url?: string, config?: Partial<DbConfig>): DbAdapter {
    const dbUrl = url || process.env.DATABASE_URL || 'file:./data.db'

    if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
        return createPgAdapter(dbUrl, config)
    }

    return createSqliteAdapter(dbUrl)
}

export function getDefaultAdapter(): DbAdapter {
    if (!defaultAdapter) {
        defaultAdapter = getDbAdapter()
    }
    return defaultAdapter
}

export async function closeDefaultAdapter(): Promise<void> {
    if (defaultAdapter) {
        await defaultAdapter.close()
        defaultAdapter = null
    }
}
