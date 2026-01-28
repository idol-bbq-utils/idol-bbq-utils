import DB from '@idol-bbq-utils/db'
import { Platform } from '@idol-bbq-utils/spider/types'
import { createLogger } from '@idol-bbq-utils/log'

const log = createLogger({ defaultMeta: { service: 'AccountPool' } })

interface Account {
    id: number
    name: string
    platform: string | number
    cookie_string: string | null
    status: string
    last_used_at: Date
    is_encrypted: boolean
    failure_count: number
    last_failure_at: Date | null
    ban_until: Date | null
    created_at: Date
    updated_at: Date
}

export class AccountPoolService {
    private accountCache: Map<Platform, Account[]> = new Map()
    private initialized: boolean = false
    private lastRefreshTime: Date = new Date(0)
    private readonly ONE_HOUR_IN_MS: number = 60 * 60 * 1000

    async initialize(): Promise<void> {
        if (this.initialized) {
            log.warn('AccountPoolService already initialized')
            return
        }

        log.info('Initializing AccountPoolService...')
        await this.unbanExpiredAccounts()
        await this.refreshFromDatabase()
        this.initialized = true
        log.info('AccountPoolService initialized successfully')
    }

    /**
     * Load all active accounts from database into memory cache.
     * Accounts are grouped by platform and sorted by last_used_at (oldest first).
     */
    async refreshFromDatabase(): Promise<void> {
        try {
            log.info('Refreshing account cache from database...')

            const allAccounts = await DB.Account.getAllActiveAccounts()
            this.accountCache.clear()

            for (const account of allAccounts) {
                const platform = account.platform as Platform

                if (!this.accountCache.has(platform)) {
                    this.accountCache.set(platform, [])
                }

                this.accountCache.get(platform)!.push(account as Account)
            }

            for (const [platform, accounts] of this.accountCache.entries()) {
                accounts.sort((a, b) => a.last_used_at.getTime() - b.last_used_at.getTime())
                log.debug(`Platform ${Platform[platform]}: loaded ${accounts.length} account(s)`)
            }

            this.lastRefreshTime = new Date()
            const nextRefreshTime = new Date(this.lastRefreshTime.getTime() + this.ONE_HOUR_IN_MS)
            log.info(
                `Account cache refreshed successfully. Total accounts: ${allAccounts.length}. Next refresh at: ${nextRefreshTime.toISOString()}`,
            )
        } catch (error: any) {
            log.error('Failed to refresh account cache:', error.message)
            throw error
        }
    }

    /**
     * Check if cache needs refresh (every 1 hour).
     */
    private shouldRefreshCache(): boolean {
        const now = Date.now()
        const elapsed = now - this.lastRefreshTime.getTime()
        return elapsed > this.ONE_HOUR_IN_MS
    }

    /**
     * Get account from memory cache using Round-Robin scheduling.
     * Selects the account with the oldest last_used_at timestamp.
     */
    async getAccount(platform: Platform, accountName?: string): Promise<Account | null> {
        if (!this.initialized) {
            log.warn('AccountPoolService not initialized, initializing now...')
            await this.initialize()
        }

        if (this.shouldRefreshCache()) {
            log.info('Cache expired, refreshing from database...')
            await this.refreshFromDatabase()
        }

        try {
            const accounts = this.accountCache.get(platform) || []

            if (accounts.length === 0) {
                log.warn(`No accounts in cache for platform ${Platform[platform]}`)
                return null
            }

            const now = new Date()
            const availableAccounts = accounts.filter(
                (acc) => acc.status === 'active' && (!acc.ban_until || acc.ban_until < now),
            )

            if (availableAccounts.length === 0) {
                log.warn(`No available accounts for platform ${Platform[platform]} (all banned or inactive)`)
                return null
            }

            if (accountName) {
                const account = availableAccounts.find((acc) => acc.name === accountName)
                if (!account) {
                    log.warn(
                        `Requested account ${accountName} not found or not available for platform ${Platform[platform]}`,
                    )
                    return null
                }
                log.info(
                    `Selected requested account: ${account.name} (id: ${account.id}) for platform ${Platform[platform]}`,
                )
                return account
            }

            const selectedAccount = availableAccounts[0]!
            log.info(
                `Selected account (Round-Robin): ${selectedAccount.name} (id: ${selectedAccount.id}) for platform ${Platform[platform]} (last_used_at: ${selectedAccount.last_used_at.toISOString()})`,
            )
            return selectedAccount
        } catch (error: any) {
            log.error(`Failed to get account for platform ${Platform[platform]}:`, error.message)
            throw error
        }
    }

    async getAllAvailableAccounts(platform: Platform): Promise<Account[]> {
        if (!this.initialized) {
            log.warn('AccountPoolService not initialized, initializing now...')
            await this.initialize()
        }

        if (this.shouldRefreshCache()) {
            await this.refreshFromDatabase()
        }

        try {
            const accounts = this.accountCache.get(platform) || []
            const now = new Date()
            const availableAccounts = accounts.filter(
                (acc) => acc.status === 'active' && (!acc.ban_until || acc.ban_until < now),
            )

            log.info(`Found ${availableAccounts.length} available account(s) for platform ${Platform[platform]}`)
            return availableAccounts
        } catch (error: any) {
            log.error(`Failed to get all accounts for platform ${Platform[platform]}:`, error.message)
            throw error
        }
    }

    /**
     * Release account back to pool and update last_used_at.
     * Updates both database and memory cache, then re-sorts cache for Round-Robin.
     */
    async releaseAccount(id: number): Promise<void> {
        try {
            const now = new Date()
            await DB.Account.updateAccountLastUsed(id)

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.last_used_at = now
                    accounts.sort((a, b) => a.last_used_at.getTime() - b.last_used_at.getTime())
                    log.debug(`Released account (id: ${id}) and re-sorted platform ${Platform[platform]} cache`)
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to release account (id: ${id}):`, error.message)
            throw error
        }
    }

    async markAccountAsActive(id: number): Promise<void> {
        try {
            await DB.Account.updateAccountStatus(id, 'active')

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.status = 'active'
                    account.ban_until = null
                    log.info(`Account (id: ${id}) marked as active in cache`)
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to mark account as active (id: ${id}):`, error.message)
            throw error
        }
    }

    async markAccountAsInactive(id: number): Promise<void> {
        try {
            await DB.Account.updateAccountStatus(id, 'inactive')

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.status = 'inactive'
                    log.warn(`Account (id: ${id}) marked as inactive in cache`)
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to mark account as inactive (id: ${id}):`, error.message)
            throw error
        }
    }

    async markAccountAsBanned(id: number): Promise<void> {
        try {
            await DB.Account.updateAccountStatus(id, 'banned')

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.status = 'banned'
                    log.error(`Account (id: ${id}) marked as BANNED in cache`)
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to mark account as banned (id: ${id}):`, error.message)
            throw error
        }
    }

    async getAccountById(id: number): Promise<Account | null> {
        try {
            const account = await DB.Account.getAccountById(id)
            return account || null
        } catch (error: any) {
            log.error(`Failed to get account by id (${id}):`, error.message)
            throw error
        }
    }

    async getAccountByName(name: string): Promise<Account | null> {
        try {
            const account = await DB.Account.getAccountByName(name)
            return account || null
        } catch (error: any) {
            log.error(`Failed to get account by name (${name}):`, error.message)
            throw error
        }
    }

    async reportAccountFailure(id: number, banDurationMinutes: number = 30): Promise<void> {
        try {
            await DB.Account.reportAccountFailure(id, banDurationMinutes)

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.failure_count = (account.failure_count || 0) + 1

                    if (account.failure_count >= 3) {
                        account.status = 'inactive'
                        account.ban_until = new Date(Date.now() + banDurationMinutes * 60 * 1000)
                        log.warn(
                            `Account (id: ${id}) banned until ${account.ban_until.toISOString()} after ${account.failure_count} failures`,
                        )
                    } else {
                        log.warn(`Account (id: ${id}) failure count: ${account.failure_count}/3`)
                    }
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to report account failure (id: ${id}):`, error.message)
            throw error
        }
    }

    async reportAccountSuccess(id: number): Promise<void> {
        try {
            await DB.Account.reportAccountSuccess(id)

            for (const [platform, accounts] of this.accountCache.entries()) {
                const account = accounts.find((acc) => acc.id === id)
                if (account) {
                    account.failure_count = 0
                    log.debug(`Account (id: ${id}) failure count reset to 0`)
                    break
                }
            }
        } catch (error: any) {
            log.error(`Failed to report account success (id: ${id}):`, error.message)
            throw error
        }
    }

    async unbanExpiredAccounts(): Promise<number> {
        try {
            const count = await DB.Account.unbanExpiredAccounts()
            if (count > 0) {
                log.info(`Unbanned ${count} expired account(s), refreshing cache...`)
                await this.refreshFromDatabase()
            }
            return count
        } catch (error: any) {
            log.error(`Failed to unban expired accounts:`, error.message)
            throw error
        }
    }
}

export const accountPoolService = new AccountPoolService()
