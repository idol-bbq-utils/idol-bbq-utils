import { Platform } from '@idol-bbq-utils/spider/types'
import type { GenericFollows } from '@idol-bbq-utils/spider/types'
import { prisma, Prisma } from './client'
import { getSubtractTime } from '@idol-bbq-utils/utils'
import type { Article } from '@idol-bbq-utils/render/types'
import { spiderRegistry } from '@idol-bbq-utils/spider'

export { ensureMigrations } from './migrate'
// export { setupPrismaClient } from './setup-client'

type ArticleWithId = Article & { id: number }

type DBArticle = Prisma.articleGetPayload<{}>
type DBFollows = Prisma.followGetPayload<{}>
namespace DB {
    export namespace Article {
        export async function checkExist(article: Article) {
            return await prisma.article.findUnique({
                where: {
                    a_id_platform: {
                        a_id: article.a_id,
                        platform: article.platform,
                    },
                },
            })
        }

        export async function trySave(article: Article): Promise<DBArticle | undefined> {
            let exist_one = await checkExist(article)
            if (exist_one) {
                return
            }
            return await save(article)
        }

        export async function save(article: Article): Promise<DBArticle> {
            let exist_one = await checkExist(article)
            if (exist_one) {
                return exist_one
            }
            let ref: number | undefined = undefined
            // 递归注意
            if (article.ref) {
                if (typeof article.ref === 'object') {
                    ref = (await save(article.ref)).id
                }
                if (typeof article.ref === 'string') {
                    ref = (await getByArticleCode(article.ref, article.platform))?.id
                }
            }
            const res = await prisma.article.create({
                data: {
                    ...article,
                    ref: ref,
                    extra: article.extra ? (article.extra as unknown as Prisma.JsonObject) : Prisma.JsonNull,
                    media: (article.media as unknown as Prisma.JsonArray) ?? Prisma.JsonNull,
                },
            })
            return res
        }

        export async function get(id: number) {
            return await prisma.article.findUnique({
                where: {
                    id: id,
                },
            })
        }

        export async function getByArticleCode(a_id: string, platform: Platform) {
            return await prisma.article.findUnique({
                where: {
                    a_id_platform: {
                        a_id,
                        platform,
                    },
                },
            })
        }

        export async function getSingleArticle(id: number) {
            const article = await prisma.article.findUnique({
                where: {
                    id: id,
                },
            })
            if (!article) {
                return
            }
            return await getFullChainArticle(article)
        }

        export async function getSingleArticleByArticleCode(a_id: string, platform: Platform) {
            const article = await prisma.article.findUnique({
                where: {
                    a_id_platform: {
                        a_id,
                        platform,
                    },
                },
            })
            if (!article) {
                return
            }
            return await getFullChainArticle(article)
        }

        async function getFullChainArticle(article: DBArticle) {
            let currentRefId = article.ref
            let currentArticle = article as unknown as ArticleWithId
            while (currentRefId) {
                const foundArticle = await prisma.article.findUnique({
                    where: {
                        id: currentRefId,
                    },
                })
                currentRefId = foundArticle?.ref || null
                currentArticle.ref = foundArticle as unknown as ArticleWithId
                currentArticle = foundArticle as unknown as ArticleWithId
            }
            return article as unknown as ArticleWithId
        }

        export async function getArticlesByName(u_id: string, platform: Platform, count = 10) {
            const res = await prisma.article.findMany({
                where: {
                    platform: platform,
                    u_id: u_id,
                },
                orderBy: {
                    created_at: 'desc',
                },
                take: count,
            })
            const articles = await Promise.all(res.map(async ({ id }) => getSingleArticle(id)))
            return articles.filter((item) => item) as ArticleWithId[]
        }
    }

    export namespace Follow {
        export async function save(follows: GenericFollows) {
            return await prisma.follow.create({
                data: {
                    ...follows,
                    created_at: Math.floor(Date.now() / 1000),
                },
            })
        }

        export async function getLatestAndComparisonFollowsByName(
            u_id: string,
            platform: Platform,
            window: string,
        ): Promise<[DBFollows, DBFollows | null] | null> {
            const latest = await prisma.follow.findFirst({
                where: {
                    platform: platform,
                    u_id: u_id,
                },
                orderBy: {
                    created_at: 'desc',
                },
            })
            if (!latest) {
                return null
            }
            const latestTime = latest.created_at
            const subtractTime = getSubtractTime(latestTime, window)
            const comparison = await prisma.follow.findFirst({
                where: {
                    platform: platform,
                    u_id: u_id,
                    created_at: {
                        lte: subtractTime,
                    },
                },
                orderBy: {
                    created_at: 'desc',
                },
            })
            return [latest, comparison]
        }
    }

    export namespace SendBy {
        export async function checkExist(ref_id: number, sender_id: string, task_type: string) {
            return await prisma.send_by.findUnique({
                where: {
                    ref_id_sender_id_task_type: {
                        ref_id,
                        sender_id,
                        task_type,
                    },
                },
            })
        }

        export async function batchCheckExist(articleIds: number[], targetIds: string[], taskType: string) {
            return await prisma.send_by.findMany({
                where: {
                    ref_id: { in: articleIds },
                    sender_id: { in: targetIds },
                    task_type: taskType,
                },
                select: { ref_id: true, sender_id: true },
            })
        }

        export async function save(ref_id: number, sender_id: string, task_type: string) {
            let exist_one = await checkExist(ref_id, sender_id, task_type)
            if (exist_one) {
                return exist_one
            }
            return await prisma.send_by.create({
                data: {
                    ref_id,
                    sender_id,
                    task_type,
                },
            })
        }

        export async function deleteRecord(ref_id: number, sender_id: string, task_type: string) {
            let exist_one = await checkExist(ref_id, sender_id, task_type)
            if (!exist_one) {
                return
            }
            return await prisma.send_by.delete({
                where: {
                    ref_id_sender_id_task_type: {
                        ref_id,
                        sender_id,
                        task_type,
                    },
                },
            })
        }

        export async function queryPendingArticleIds(websites: string[], sender_ids: string[]): Promise<number[]> {
            const articleIdsSet: Set<number> = new Set()
            const targets = sender_ids

            for (const website of websites) {
                const { u_id, platform } = spiderRegistry.extractBasicInfo(website) ?? {}
                if (!u_id || !platform) continue

                const articles = await DB.Article.getArticlesByName(u_id, platform)
                if (articles.length === 0) continue

                const articleIdList = articles.map((a) => a.id)

                const forwardedRecords = await DB.SendBy.batchCheckExist(articleIdList, targets, 'article')

                const forwardedMap = new Map<number, Set<string>>()
                for (const record of forwardedRecords) {
                    if (!forwardedMap.has(record.ref_id)) {
                        forwardedMap.set(record.ref_id, new Set())
                    }
                    forwardedMap.get(record.ref_id)!.add(record.sender_id)
                }

                for (const article of articles) {
                    const forwardedTargets = forwardedMap.get(article.id) || new Set()
                    const needsForwarding = targets.some((t) => !forwardedTargets.has(t))
                    if (needsForwarding) {
                        articleIdsSet.add(article.id)
                    }
                }
            }

            return Array.from(articleIdsSet)
        }
    }
}

export default DB
export type { Article, ArticleWithId, DBFollows }
