import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL || 'file:./data.db'
const dbPath = DATABASE_URL.replace('file:', '')

const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })

export { schema }
