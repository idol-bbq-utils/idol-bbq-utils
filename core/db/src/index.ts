import { getDefaultAdapter, type DbAdapter } from './adapter'
import {
    createArticleOperations,
    createFollowOperations,
    createSendByOperations,
    createAccountOperations,
    type ArticleOperations,
    type FollowOperations,
    type SendByOperations,
    type AccountOperations,
} from './operations'

export { ensureMigrations } from './migrate'
export type { Article } from '@idol-bbq-utils/render/types'
export type { ArticleWithId, DBFollows, AccountStatus } from './operations'

const createCachedOperations = () => {
    let adapter: DbAdapter | null = null
    let articleOps: ArticleOperations | null = null
    let followOps: FollowOperations | null = null
    let sendByOps: SendByOperations | null = null
    let accountOps: AccountOperations | null = null

    const getAdapter = () => {
        if (!adapter) adapter = getDefaultAdapter()
        return adapter
    }

    return {
        get Article() {
            if (!articleOps) articleOps = createArticleOperations(getAdapter() as any)
            return articleOps
        },
        get Follow() {
            if (!followOps) followOps = createFollowOperations(getAdapter() as any)
            return followOps
        },
        get SendBy() {
            if (!sendByOps) {
                const adapter = getAdapter()
                const article = this.Article
                sendByOps = createSendByOperations(adapter as any, article)
            }
            return sendByOps
        },
        get Account() {
            if (!accountOps) accountOps = createAccountOperations(getAdapter() as any)
            return accountOps
        },

        reset() {
            adapter = null
            articleOps = null
            followOps = null
            sendByOps = null
            accountOps = null
        },
    }
}

const DB = createCachedOperations()
export default DB
