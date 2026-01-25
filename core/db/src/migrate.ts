import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

/**
 * 执行 Prisma 数据库迁移
 *
 * 这个函数会在应用启动时自动执行，确保数据库 schema 是最新的
 * 使用 `prisma migrate deploy` 命令来应用所有待执行的 migration
 *
 * @throws {Error} 当 schema 文件不存在或迁移失败时抛出错误
 */
export async function ensureMigrations(): Promise<void> {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma')

    if (!existsSync(schemaPath)) {
        console.error(`[DB Migration] ❌ Schema file not found at ${schemaPath}`)
        throw new Error('Prisma schema file not found')
    }

    try {
        console.log('[DB Migration] 🔄 Starting database migration...')
        console.log(`[DB Migration] Schema path: ${schemaPath}`)
        console.log(`[DB Migration] DATABASE_URL: ${process.env.DATABASE_URL}`)

        execSync(`prisma migrate deploy --schema=${schemaPath}`, {
            stdio: 'inherit',
            env: process.env,
        })

        console.log('[DB Migration] ✅ Database migration completed successfully')
    } catch (error) {
        console.error('[DB Migration] ❌ Migration failed:', error)
        throw error
    }
}
