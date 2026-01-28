import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '../schema/sqlite'
import type { SqliteAdapter } from './types'
import { existsSync, statSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { dirname } from 'path'

export function createSqliteAdapter(url: string): SqliteAdapter {
    const dbPath = url.replace(/^file:/, '')

    if (existsSync(dbPath)) {
        const stats = statSync(dbPath)

        if (stats.isDirectory()) {
            console.error(`[SQLite] ERROR: Path is a directory, not a file: ${dbPath}`)
            throw new Error(`Database path is a directory: ${dbPath}`)
        }
    }

    const needsInitialization = !existsSync(dbPath) || statSync(dbPath).size === 0

    if (needsInitialization) {
        console.log(`[SQLite] Database file does not exist or is empty: ${dbPath}`)
        console.log('[SQLite] Creating empty database file...')

        const dir = dirname(dbPath)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }

        writeFileSync(dbPath, '')
        console.log(`[SQLite] Empty database file created: ${dbPath}`)
    }

    const sqlite = new Database(dbPath)
    const db = drizzle(sqlite, { schema })

    return {
        dialect: 'sqlite',
        db,
        schema,
        async close() {
            sqlite.close()
        },
    }
}
