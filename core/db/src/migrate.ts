import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client'
import { existsSync } from 'fs'
import path from 'path'

export async function ensureMigrations(): Promise<void> {
    console.log('[DB Migration] 🔄 Starting database migration...')
    console.log(`[DB Migration] DATABASE_URL: ${process.env.DATABASE_URL}`)

    let migrationsFolder: string
    if (existsSync(path.join(__dirname, '../drizzle'))) {
        migrationsFolder = path.join(__dirname, '../drizzle')
    } else if (existsSync('/app/drizzle')) {
        migrationsFolder = '/app/drizzle'
    } else {
        console.error('[DB Migration] ❌ Migrations folder not found')
        console.error(`[DB Migration] Searched paths:`)
        console.error(`  - ${path.join(__dirname, '../drizzle')}`)
        console.error(`  - /app/drizzle`)
        throw new Error('Drizzle migrations folder not found')
    }

    try {
        console.log(`[DB Migration] Migrations folder: ${migrationsFolder}`)
        await migrate(db, { migrationsFolder })
        console.log('[DB Migration] ✅ Database migration completed successfully')
    } catch (error) {
        console.error('[DB Migration] ❌ Migration failed:', error)
        throw error
    }
}
