#!/usr/bin/env bun
import { createPgAdapter } from '../src/adapter/pg.adapter'
import { readFileSync } from 'fs'

const PG_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/idol_bbq'
const INPUT_FILE = process.env.INPUT_FILE || './export.json'

async function importData() {
    console.log('[Import] Starting PostgreSQL data import...')
    console.log(`[Import] Database: ${PG_URL}`)
    console.log(`[Import] Input: ${INPUT_FILE}`)

    const adapter = createPgAdapter(PG_URL)

    console.log('[Import] Reading export file...')
    const exportData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'))

    console.log(`[Import] Export version: ${exportData.version}`)
    console.log(`[Import] Exported at: ${exportData.exported_at}`)
    console.log(`[Import] Source dialect: ${exportData.source_dialect}`)
    console.log(`[Import] Articles: ${exportData.articles.length}`)
    console.log(`[Import] Follows: ${exportData.follows.length}`)
    console.log(`[Import] SendBy: ${exportData.sendBy.length}`)

    console.log('[Import] Importing articles...')
    for (const article of exportData.articles) {
        await adapter.db.insert(adapter.schema.article).values(article).onConflictDoNothing()
    }
    console.log(`[Import] Imported ${exportData.articles.length} articles`)

    console.log('[Import] Importing follows...')
    for (const follow of exportData.follows) {
        await adapter.db.insert(adapter.schema.follow).values(follow)
    }
    console.log(`[Import] Imported ${exportData.follows.length} follows`)

    console.log('[Import] Importing sendBy records...')
    for (const sendBy of exportData.sendBy) {
        await adapter.db.insert(adapter.schema.sendBy).values(sendBy).onConflictDoNothing()
    }
    console.log(`[Import] Imported ${exportData.sendBy.length} sendBy records`)

    console.log('[Import] Import completed successfully!')
    await adapter.close()
}

importData().catch((error) => {
    console.error('[Import] Import failed:', error)
    process.exit(1)
})
