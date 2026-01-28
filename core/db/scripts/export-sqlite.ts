#!/usr/bin/env bun
import { createSqliteAdapter } from '../src/adapter/sqlite.adapter'
import { createArticleOperations, createFollowOperations, createSendByOperations } from '../src/operations'
import { writeFileSync } from 'fs'
import { Platform } from '@idol-bbq-utils/spider/types'

const DB_PATH = process.env.SQLITE_DB_PATH || 'file:./data.db'
const OUTPUT_FILE = process.env.OUTPUT_FILE || './export.json'

async function exportData() {
    console.log('[Export] Starting SQLite data export...')
    console.log(`[Export] Database: ${DB_PATH}`)
    console.log(`[Export] Output: ${OUTPUT_FILE}`)

    const adapter = createSqliteAdapter(DB_PATH)
    const articleOps = createArticleOperations(adapter)

    console.log('[Export] Fetching all data from database...')

    const articlesRaw = await adapter.db.select().from(adapter.schema.article).all()
    const followsRaw = await adapter.db.select().from(adapter.schema.follow).all()
    const sendByRaw = await adapter.db.select().from(adapter.schema.sendBy).all()

    console.log(`[Export] Found ${articlesRaw.length} articles`)
    console.log(`[Export] Found ${followsRaw.length} follows`)
    console.log(`[Export] Found ${sendByRaw.length} sendBy records`)

    const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        source_dialect: 'sqlite',
        articles: articlesRaw,
        follows: followsRaw,
        sendBy: sendByRaw,
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2))
    console.log(`[Export] Successfully exported data to ${OUTPUT_FILE}`)

    await adapter.close()
}

exportData().catch((error) => {
    console.error('[Export] Export failed:', error)
    process.exit(1)
})
