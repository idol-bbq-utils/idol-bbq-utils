import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { getDefaultAdapter } from './adapter'
import { existsSync } from 'fs'
import path from 'path'

export async function ensureMigrations(): Promise<void> {
    console.log('[DB Migration] Starting database migration...')
    console.log(`[DB Migration] DATABASE_URL: ${process.env.DATABASE_URL}`)

    const adapter = getDefaultAdapter()
    console.log(`[DB Migration] Detected dialect: ${adapter.dialect}`)

    const dialectFolder = adapter.dialect === 'sqlite' ? 'sqlite' : 'pg'
    let migrationsFolder: string

    if (existsSync(path.join(__dirname, '../drizzle', dialectFolder))) {
        migrationsFolder = path.join(__dirname, '../drizzle', dialectFolder)
    } else if (existsSync(path.join('/app/drizzle', dialectFolder))) {
        migrationsFolder = path.join('/app/drizzle', dialectFolder)
    } else {
        console.error('[DB Migration] Migrations folder not found')
        console.error(`[DB Migration] Searched paths:`)
        console.error(`  - ${path.join(__dirname, '../drizzle', dialectFolder)}`)
        console.error(`  - ${path.join('/app/drizzle', dialectFolder)}`)
        throw new Error(`Drizzle migrations folder not found for dialect: ${adapter.dialect}`)
    }

    try {
        console.log(`[DB Migration] Migrations folder: ${migrationsFolder}`)

        if (adapter.dialect === 'sqlite') {
            await migrateSqlite(adapter.db, { migrationsFolder })
        } else {
            await migratePg(adapter.db, { migrationsFolder })
        }

        console.log('[DB Migration] Database migration completed successfully')
    } catch (error) {
        console.error('[DB Migration] Migration failed:', error)
        throw error
    }
}
