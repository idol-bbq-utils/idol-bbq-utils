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
    let schemaPath: string
    if (existsSync(path.join(__dirname, '../prisma/schema.prisma'))) {
        schemaPath = path.join(__dirname, '../prisma/schema.prisma')
    } else if (existsSync('/app/prisma/schema.prisma')) {
        schemaPath = '/app/prisma/schema.prisma'
    } else {
        console.error('[DB Migration] ❌ Schema file not found')
        console.error(`[DB Migration] Searched paths:`)
        console.error(`  - ${path.join(__dirname, '../prisma/schema.prisma')}`)
        console.error(`  - /app/prisma/schema.prisma`)
        throw new Error('Prisma schema file not found')
    }
    try {
        console.log('[DB Migration] 🔄 Starting database migration...')
        console.log(`[DB Migration] Schema path: ${schemaPath}`)
        console.log(`[DB Migration] DATABASE_URL: ${process.env.DATABASE_URL}`)

        // 在 Docker 环境中使用完整路径，在开发环境中使用 npx
        const prismaCmd = existsSync('/usr/local/bin/prisma') ? '/usr/local/bin/prisma' : 'npx prisma'

        console.log(`[DB Migration] Using Prisma command: ${prismaCmd}`)

        execSync(`${prismaCmd} migrate deploy --schema=${schemaPath}`, {
            stdio: 'inherit',
            env: process.env,
        })
        console.log('[DB Migration] ✅ Database migration completed successfully')
    } catch (error) {
        console.error('[DB Migration] ❌ Migration failed:', error)
        throw error
    }
}
