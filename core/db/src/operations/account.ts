import { Platform } from '@idol-bbq-utils/spider/types'
import type { SqliteAdapter, PgAdapter } from '../adapter/types'
import { createDbFacade } from '../facade'
import type * as sqliteSchema from '../schema/sqlite'
import type * as pgSchema from '../schema/pg'
import { eq, lt, isNotNull, or, isNull } from 'drizzle-orm'

export type AccountStatus = 'active' | 'inactive' | 'banned' | 'unknown'

type DBAccount = typeof sqliteSchema.sqliteAccount.$inferSelect | typeof pgSchema.pgAccount.$inferSelect
type DBNewAccount = typeof sqliteSchema.sqliteAccount.$inferInsert | typeof pgSchema.pgAccount.$inferInsert

export interface AccountOperations {
    createAccount(
        newAccount: Omit<DBNewAccount, 'id' | 'created_at' | 'updated_at' | 'last_used_at'>,
    ): Promise<DBAccount>
    getAccountById(id: number): Promise<DBAccount | undefined>
    getAccountByName(name: string): Promise<DBAccount | undefined>
    updateAccount(id: number, updates: Partial<Omit<DBNewAccount, 'id' | 'created_at'>>): Promise<DBAccount | undefined>
    deleteAccount(id: number): Promise<void>
    getAllActiveAccounts(): Promise<DBAccount[]>
    getAllAvailableAccounts(platform: Platform): Promise<DBAccount[]>
    findAvailableAccount(platform: Platform, requestedAccountName?: string): Promise<DBAccount | undefined>
    updateAccountLastUsed(id: number): Promise<void>
    updateAccountStatus(id: number, status: AccountStatus): Promise<void>
    reportAccountFailure(id: number, banDurationMinutes?: number): Promise<void>
    reportAccountSuccess(id: number): Promise<void>
    unbanExpiredAccounts(): Promise<number>
}

export function createAccountOperations(adapter: SqliteAdapter): AccountOperations
export function createAccountOperations(adapter: PgAdapter): AccountOperations
export function createAccountOperations(adapter: SqliteAdapter | PgAdapter): AccountOperations {
    const db = createDbFacade(adapter)
    const schema = adapter.schema
    const accountTable = adapter.dialect === 'pg' ? (schema as any).pgAccount : (schema as any).sqliteAccount

    async function createAccount(
        newAccount: Omit<DBNewAccount, 'id' | 'created_at' | 'updated_at' | 'last_used_at'>,
    ): Promise<DBAccount> {
        const now = new Date()
        const accountToInsert = {
            ...newAccount,
            status: (newAccount.status || 'active') as AccountStatus,
            last_used_at: now,
            created_at: now,
            updated_at: now,
        }

        const result = await db
            .insert(accountTable as any)
            .values(accountToInsert as any)
            .returning()

        if (result.length === 0) {
            throw new Error('Failed to create account.')
        }
        return result[0] as DBAccount
    }

    async function getAccountById(id: number): Promise<DBAccount | undefined> {
        return await db.account.findFirst({
            where: (table, { eq }) => eq(table.id, id),
        })
    }

    async function getAccountByName(name: string): Promise<DBAccount | undefined> {
        return await db.account.findFirst({
            where: (table, { eq }) => eq(table.name, name),
        })
    }

    async function updateAccount(
        id: number,
        updates: Partial<Omit<DBNewAccount, 'id' | 'created_at'>>,
    ): Promise<DBAccount | undefined> {
        const now = new Date()
        const result = await db
            .update(accountTable as any)
            .set({ ...updates, updated_at: now } as any)
            .where(eq((accountTable as any).id, id))
            .returning()

        return result.at(0) as DBAccount | undefined
    }

    async function deleteAccount(id: number): Promise<void> {
        await db
            .delete(accountTable as any)
            .where(eq((accountTable as any).id, id))
            .returning()
    }

    async function getAllActiveAccounts(): Promise<DBAccount[]> {
        const now = new Date()
        const accounts = await db.account.findMany({
            where: (table, { eq, and }) => {
                return and(eq(table.status, 'active'), or(isNull(table.ban_until), lt(table.ban_until as any, now)))
            },
            orderBy: (table, { asc }) => [asc(table.platform), asc(table.last_used_at)],
        })

        return accounts
    }

    async function getAllAvailableAccounts(platform: Platform): Promise<DBAccount[]> {
        const now = new Date()
        const accounts = await db.account.findMany({
            where: (table, { eq, and }) => {
                const conditions = [
                    eq(table.status, 'active'),
                    eq(table.platform, platform as any),
                    or(isNull(table.ban_until), lt(table.ban_until as any, now)),
                ]
                return and(...conditions)
            },
            orderBy: (table, { asc }) => [asc(table.last_used_at)],
        })

        return accounts
    }

    async function findAvailableAccount(
        platform: Platform,
        requestedAccountName?: string,
    ): Promise<DBAccount | undefined> {
        const now = new Date()
        const accounts = await db.account.findMany({
            where: (table, { eq, and }) => {
                const conditions = [
                    eq(table.status, 'active'),
                    eq(table.platform, platform as any),
                    or(isNull(table.ban_until), lt(table.ban_until as any, now)),
                ]

                if (requestedAccountName) {
                    conditions.push(eq(table.name, requestedAccountName))
                }

                return and(...conditions)
            },
            orderBy: (table, { asc }) => [asc(table.last_used_at)],
            limit: 1,
        })

        return accounts.at(0)
    }

    async function updateAccountLastUsed(id: number): Promise<void> {
        const now = new Date()
        await db
            .update(accountTable as any)
            .set({ last_used_at: now, updated_at: now } as any)
            .where(eq((accountTable as any).id, id))
            .returning()
    }

    async function updateAccountStatus(id: number, status: AccountStatus): Promise<void> {
        const now = new Date()
        await db
            .update(accountTable as any)
            .set({ status, updated_at: now } as any)
            .where(eq((accountTable as any).id, id))
            .returning()
    }

    async function reportAccountFailure(id: number, banDurationMinutes: number = 30): Promise<void> {
        const now = new Date()
        const account = await getAccountById(id)

        if (!account) {
            return
        }

        const newFailureCount = (account.failure_count || 0) + 1
        const maxFailures = 3

        const updates: any = {
            failure_count: newFailureCount,
            last_failure_at: now,
            updated_at: now,
        }

        if (newFailureCount >= maxFailures) {
            const banUntil = new Date(now.getTime() + banDurationMinutes * 60 * 1000)
            updates.status = 'inactive'
            updates.ban_until = banUntil
        }

        await db
            .update(accountTable as any)
            .set(updates)
            .where(eq((accountTable as any).id, id))
            .returning()
    }

    async function reportAccountSuccess(id: number): Promise<void> {
        const now = new Date()
        await db
            .update(accountTable as any)
            .set({
                failure_count: 0,
                last_failure_at: null,
                ban_until: null,
                updated_at: now,
            } as any)
            .where(eq((accountTable as any).id, id))
            .returning()
    }

    async function unbanExpiredAccounts(): Promise<number> {
        const now = new Date()

        const expiredAccounts = await db.account.findMany({
            where: (table, { and, eq }) =>
                and(eq(table.status, 'inactive'), isNotNull(table.ban_until), lt(table.ban_until as any, now)),
        })

        for (const account of expiredAccounts) {
            await db
                .update(accountTable as any)
                .set({
                    status: 'active',
                    ban_until: null,
                    failure_count: 0,
                    updated_at: now,
                } as any)
                .where(eq((accountTable as any).id, account.id))
                .returning()
        }

        return expiredAccounts.length
    }

    return {
        createAccount,
        getAccountById,
        getAccountByName,
        updateAccount,
        deleteAccount,
        getAllActiveAccounts,
        getAllAvailableAccounts,
        findAvailableAccount,
        updateAccountLastUsed,
        updateAccountStatus,
        reportAccountFailure,
        reportAccountSuccess,
        unbanExpiredAccounts,
    }
}
