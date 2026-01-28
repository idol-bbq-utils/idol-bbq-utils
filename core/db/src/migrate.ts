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

    if (adapter.dialect === 'pg') {
        console.log('[DB Migration] Checking PostgreSQL encoding...')
        const encodingResult = await adapter.db.execute(`
            SELECT 
                current_database() as database,
                pg_encoding_to_char(encoding) as encoding,
                datcollate as collate,
                datctype as ctype
            FROM pg_database 
            WHERE datname = current_database()
        `)
        const dbInfo = encodingResult[0] as any
        console.log(`[DB Migration] Database: ${dbInfo.database}`)
        console.log(`[DB Migration] Encoding: ${dbInfo.encoding}`)
        console.log(`[DB Migration] Collate: ${dbInfo.collate}`)
        console.log(`[DB Migration] Ctype: ${dbInfo.ctype}`)

        if (dbInfo.encoding !== 'UTF8') {
            console.error('')
            console.error('MIGRATION BLOCKED: Database encoding is not UTF8!')
            console.error(`   Current encoding: ${dbInfo.encoding}`)
            console.error('')
            console.error('UTF8 encoding is REQUIRED for storing Japanese and Chinese text.')
            console.error('')
            console.error('Solution: Recreate database with UTF8 encoding')
            console.error('  Run: psql -U postgres < core/db/scripts/recreate-pg-utf8.sql')
            console.error('')
            console.error('Or manually:')
            console.error('  DROP DATABASE your_database;')
            console.error(
                "  CREATE DATABASE your_database WITH ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;",
            )
            console.error('')
            throw new Error(`Database encoding ${dbInfo.encoding} is not supported. UTF8 required.`)
        }

        console.log('PostgreSQL encoding is UTF8')
    }

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
