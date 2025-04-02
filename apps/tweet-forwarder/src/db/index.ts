import { GenericArticle, GenericFollows, GenericMediaInfo, Platform } from '@idol-bbq-utils/spider/types'
import { prisma, Prisma } from './client'

type MediaInfo = GenericMediaInfo & { translation?: string; translated_by?: string }
type Article = Omit<GenericArticle<Platform>, 'media' | 'ref'> & {
    translation?: string
    translated_by?: string
    media: Array<MediaInfo> | null
    ref: Article | null
}

type DBArticle = Prisma.crawler_articleGetPayload<{}>

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
                    extra: article.extra ?? Prisma.JsonNull,
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

        export async function getSingleArticle(id: number): Promise<Article | undefined> {
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

        export async function getSingleArticleByArticleCode(
            a_id: string,
            platform: Platform,
        ): Promise<Article | undefined> {
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

        async function getFullChainArticle(article: DBArticle): Promise<Article> {
            let currentRefId = article.ref
            let currentArticle = article as Article
            while (currentRefId) {
                const foundArticle = await prisma.crawler_article.findUnique({
                    where: {
                        id: currentRefId,
                    },
                })
                currentRefId = foundArticle?.ref || null
                currentArticle.ref = foundArticle as Article
                currentArticle = foundArticle as Article
            }
            return article as Article
        }

        export async function getArticlesByName(u_id: string, platform: Platform, count = 10): Promise<Article[]> {
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
            return articles.filter((item) => item) as Article[]
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
    }
}

export default DB
export type { Article, MediaInfo }
