import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '../schema/sqlite'
import type { SqliteAdapter } from './types'
import { existsSync, statSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { dirname } from 'path'

export function createSqliteAdapter(url: string): SqliteAdapter {
    const dbPath = url.replace(/^file:/, '')
    const isMemory = dbPath === ':memory:'


    if (!isMemory) {
        if (existsSync(dbPath)) {
            const stats = statSync(dbPath)
            if (stats.isDirectory()) {
                throw new Error(`Database path is a directory: ${dbPath}`)
            }
        }

        const needsInitialization = !existsSync(dbPath) || statSync(dbPath).size === 0
        if (needsInitialization) {
            const dir = dirname(dbPath)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }
            writeFileSync(dbPath, '')
        }
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
