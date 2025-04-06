import {
    ArticleExtractType,
    GenericArticle,
    GenericFollows,
    GenericMediaInfo,
    Platform,
} from '@idol-bbq-utils/spider/types'
import { prisma, Prisma } from './client'
import { getSubtractTime } from '@/utils/time'

type MediaInfo = GenericMediaInfo & { translation?: string; translated_by?: string }
type Article = Omit<GenericArticle<Platform>, 'media' | 'ref'> & {
    translation?: string
    translated_by?: string
    media: Array<MediaInfo> | null
    ref: Article | null
}

type ArticleWithId = Article & { id: number }

type DBArticle = Prisma.crawler_articleGetPayload<{}>
type DBFollows = Prisma.crawler_followsGetPayload<{}>
type DBArticleExtractType = ArticleExtractType<Platform> & {
    translation?: string
    translated_by?: string
}
namespace DB {
    export namespace Article {
        export async function checkExist(article: Article) {
            return await prisma.crawler_article.findUnique({
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
                ref = (await save(article.ref)).id
            }
            const res = await prisma.crawler_article.create({
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
            return await prisma.crawler_article.findUnique({
                where: {
                    id: id,
                },
            })
        }

        export async function getByArticleCode(a_id: string, platform: Platform) {
            return await prisma.crawler_article.findUnique({
                where: {
                    a_id_platform: {
                        a_id,
                        platform,
                    },
                },
            })
        }

        export async function getSingleArticle(id: number) {
            const article = await prisma.crawler_article.findUnique({
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
            const article = await prisma.crawler_article.findUnique({
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
            let currentArticle = article as ArticleWithId
            while (currentRefId) {
                const foundArticle = await prisma.crawler_article.findUnique({
                    where: {
                        id: currentRefId,
                    },
                })
                currentRefId = foundArticle?.ref || null
                currentArticle.ref = foundArticle as ArticleWithId
                currentArticle = foundArticle as ArticleWithId
            }
            return article as ArticleWithId
        }

        export async function getArticlesByName(u_id: string, platform: Platform, count = 10) {
            const res = await prisma.crawler_article.findMany({
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
            return await prisma.crawler_follows.create({
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
            const latest = await prisma.crawler_follows.findFirst({
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
            const comparison = await prisma.crawler_follows.findFirst({
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

    export namespace ForwardBy {
        export async function checkExist(ref_id: number, bot_id: string, task_type: string) {
            return await prisma.forward_by.findUnique({
                where: {
                    ref_id_bot_id_task_type: {
                        ref_id,
                        bot_id,
                        task_type,
                    },
                },
            })
        }

        export async function save(ref_id: number, bot_id: string, task_type: string) {
            let exist_one = await checkExist(ref_id, bot_id, task_type)
            if (exist_one) {
                return exist_one
            }
            return await prisma.forward_by.create({
                data: {
                    ref_id,
                    bot_id,
                    task_type,
                },
            })
        }
    }
}

export default DB
export type { Article, ArticleWithId, MediaInfo, DBFollows, DBArticleExtractType }
