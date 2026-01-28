#!/usr/bin/env bun
import { ensureMigrations } from '../src'
import { createPgAdapter } from '../src/adapter/pg.adapter'
import { readFileSync } from 'fs'

const PG_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/idolbbq'
const INPUT_FILE = process.env.INPUT_FILE || './export.json'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10)

async function importData() {
    console.log('[Import] Starting PostgreSQL data import...')
    console.log(`[Import] Database: ${PG_URL}`)
    console.log(`[Import] Input: ${INPUT_FILE}`)
    console.log(`[Import] Batch size: ${BATCH_SIZE}`)

    const adapter = createPgAdapter(PG_URL)

    console.log('[Import] Checking database encoding...')
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
    console.log(`[Import] Database: ${dbInfo.database}`)
    console.log(`[Import] Encoding: ${dbInfo.encoding}`)
    console.log(`[Import] Collate: ${dbInfo.collate}`)
    console.log(`[Import] Ctype: ${dbInfo.ctype}`)

    if (dbInfo.encoding !== 'UTF8') {
        console.error('')
        console.error('❌ ERROR: Database encoding is not UTF8!')
        console.error(`   Current encoding: ${dbInfo.encoding}`)
        console.error('')
        console.error('Japanese and Chinese characters will NOT display correctly.')
        console.error('')
        console.error('Solution: Recreate database with UTF8 encoding')
        console.error('  1. You can manually run:')
        console.error('       DROP DATABASE your_db;')
        console.error(
            "       CREATE DATABASE your_db WITH ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;",
        )
        console.error('')
        await adapter.close()
        process.exit(1)
    }

    console.log('✅ Database encoding is UTF8')

    await ensureMigrations()
    console.log('[Import] Reading export file...')
    const exportData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'))

    console.log(`[Import] Export version: ${exportData.version}`)
    console.log(`[Import] Exported at: ${exportData.exported_at}`)
    console.log(`[Import] Source dialect: ${exportData.source_dialect}`)
    console.log(`[Import] Articles: ${exportData.articles.length}`)
    console.log(`[Import] Follows: ${exportData.follows.length}`)
    console.log(`[Import] SendBy: ${exportData.sendBy.length}`)

    console.log('[Import] Importing articles in batches...')
    const articles = exportData.articles
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
        const batch = articles.slice(i, i + BATCH_SIZE)
        await adapter.db.insert(adapter.schema.article).values(batch).onConflictDoNothing()
        const progress = Math.min(i + BATCH_SIZE, articles.length)
        console.log(
            `[Import] Articles: ${progress}/${articles.length} (${Math.round((progress / articles.length) * 100)}%)`,
        )
    }
    console.log(`[Import] Imported ${exportData.articles.length} articles`)

    console.log('[Import] Importing follows in batches...')
    const follows = exportData.follows
    for (let i = 0; i < follows.length; i += BATCH_SIZE) {
        const batch = follows.slice(i, i + BATCH_SIZE)
        await adapter.db.insert(adapter.schema.follow).values(batch)
        const progress = Math.min(i + BATCH_SIZE, follows.length)
        console.log(
            `[Import] Follows: ${progress}/${follows.length} (${Math.round((progress / follows.length) * 100)}%)`,
        )
    }
    console.log(`[Import] Imported ${exportData.follows.length} follows`)

    console.log('[Import] Importing sendBy records in batches...')
    const sendBy = exportData.sendBy
    for (let i = 0; i < sendBy.length; i += BATCH_SIZE) {
        const batch = sendBy.slice(i, i + BATCH_SIZE)
        await adapter.db.insert(adapter.schema.sendBy).values(batch).onConflictDoNothing()
        const progress = Math.min(i + BATCH_SIZE, sendBy.length)
        console.log(`[Import] SendBy: ${progress}/${sendBy.length} (${Math.round((progress / sendBy.length) * 100)}%)`)
    }
    console.log(`[Import] Imported ${exportData.sendBy.length} sendBy records`)

    console.log('[Import] Import completed successfully!')
    await adapter.close()
}

importData().catch((error) => {
    console.error('[Import] Import failed:', error)
    process.exit(1)
})
