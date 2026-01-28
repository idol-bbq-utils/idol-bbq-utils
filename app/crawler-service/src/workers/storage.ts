import DB from '@idol-bbq-utils/db'
import type { Article } from '@idol-bbq-utils/db'
import { BaseTranslator, TRANSLATION_ERROR_FALLBACK } from '@idol-bbq-utils/translator'
import { pRetry } from '@idol-bbq-utils/utils'
import type {
    SpiderArticleResult,
    SpiderFollowsResult,
} from '@idol-bbq-utils/queue/jobs'
import type { Logger } from '@idol-bbq-utils/log'

// Storage processing functions (from storage-service)
async function doTranslate(
    article: Article,
    translator: BaseTranslator,
    jobLog: Logger,
): Promise<Article> {
    const { username, a_id } = article
    jobLog.info(`[${username}] [${a_id}] Translating article...`)

    let currentArticle: Article | null = article
    let articleNeedTobeTranslated: Array<Article> = []

    while (currentArticle && typeof currentArticle === 'object') {
        articleNeedTobeTranslated.push(currentArticle)
        if (typeof currentArticle.ref !== 'string') {
            currentArticle = currentArticle.ref as Article
        } else {
            currentArticle = null
        }
    }

    jobLog.info(`[${username}] [${a_id}] Starting batch translating ${articleNeedTobeTranslated.length} articles...`)

    await Promise.all(
        articleNeedTobeTranslated.map(async (currentArticle) => {
            const { a_id, username, platform } = currentArticle

            const article_maybe_translated = await DB.Article.getByArticleCode(a_id, platform)

            if (currentArticle.content && !BaseTranslator.isValidTranslation(article_maybe_translated?.translation)) {
                const content = currentArticle.content
                jobLog.info(`[${username}] [${a_id}] Starting to translate content...`)
                const content_translation = await pRetry(() => translator.translate(content), {
                    retries: 3,
                    onFailedAttempt: (error) => {
                        jobLog.warn(
                            `[${username}] [${a_id}] Translation content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                        )
                    },
                })
                    .then((res) => res)
                    .catch((err) => {
                        jobLog.error(`[${username}] [${a_id}] Error while translating content: ${err}`)
                        return TRANSLATION_ERROR_FALLBACK
                    })
                jobLog.debug(`[${username}] [${a_id}] Translation content: ${content_translation}`)
                jobLog.info(`[${username}] [${a_id}] Translation complete.`)
                currentArticle.translation = content_translation
                currentArticle.translated_by = translator.NAME
            }

            if (currentArticle.media) {
                for (const [idx, media] of currentArticle.media.entries()) {
                    if (
                        media.alt &&
                        !BaseTranslator.isValidTranslation(
                            (article_maybe_translated?.media as unknown as Article['media'])?.[idx]?.translation,
                        )
                    ) {
                        const alt = media.alt
                        const caption_translation = await pRetry(() => translator.translate(alt), {
                            retries: 3,
                            onFailedAttempt: (error) => {
                                jobLog.warn(
                                    `[${username}] [${a_id}] Translation media alt failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                                )
                            },
                        })
                            .then((res) => res)
                            .catch((err) => {
                                jobLog.error(`[${username}] [${a_id}] Error while translating media alt: ${err}`)
                                return TRANSLATION_ERROR_FALLBACK
                            })
                        media.translation = caption_translation
                        media.translated_by = translator.NAME
                    }
                }
            }

            if (currentArticle.extra) {
                const extra_ref = currentArticle.extra
                let { content, translation } = extra_ref
                if (content && !BaseTranslator.isValidTranslation(translation)) {
                    const content_translation = await pRetry(() => translator.translate(content), {
                        retries: 3,
                        onFailedAttempt: (error) => {
                            jobLog.warn(
                                `[${username}] [${a_id}] Translation extra content failed, there are ${error.retriesLeft} retries left: ${error.originalError.message}`,
                            )
                        },
                    })
                        .then((res) => res)
                        .catch((err) => {
                            jobLog.error(`[${username}] [${a_id}] Error while translating extra content: ${err}`)
                            return TRANSLATION_ERROR_FALLBACK
                        })
                    extra_ref.translation = content_translation
                    extra_ref.translated_by = translator.NAME
                }
            }
        }),
    )

    jobLog.info(`[${username}] [${a_id}] ${articleNeedTobeTranslated.length} Articles are translated.`)
    return article
}

async function processArticleStorage(
    articles: SpiderArticleResult[],
    translator: BaseTranslator | undefined,
    jobLog: Logger,
): Promise<{ savedIds: number[]; errorCount: number }> {
    const savedIds: number[] = []
    let errorCount = 0

    for (const article of articles) {
        try {
            const exists = await DB.Article.checkExist(article)

            if (!exists) {
                let translatedArticle = article
                if (translator) {
                    translatedArticle = await doTranslate(article, translator, jobLog)
                }

                const saved = await DB.Article.trySave(translatedArticle)
                if (saved) {
                    savedIds.push(saved.id)
                    jobLog.debug(`Saved article ${article.a_id} with id ${saved.id}`)
                }
            }
        } catch (error) {
            jobLog.error(`Error saving article ${article.a_id}: ${error}`)
            errorCount++
        }
    }
    jobLog.info(`Saved ${savedIds.length} articles.`)

    return { savedIds, errorCount }
}

async function processFollowsStorage(
    followsList: SpiderFollowsResult[],
    jobLog: Logger,
): Promise<{ savedIds: number[]; errorCount: number }> {
    const savedIds: number[] = []
    let errorCount = 0

    for (const follows of followsList) {
        try {
            const saved = await DB.Follow.save(follows)
            if (saved) {
                savedIds.push(saved.id)
            }
            jobLog.debug(`Saved follows for ${follows.username} with id ${saved?.id}`)
        } catch (error) {
            jobLog.error(`Error saving follows for ${follows.username}: ${error}`)
            errorCount++
        }
    }

    jobLog.info(`Saved ${savedIds.length} follows.`)
    return { savedIds, errorCount }
}

export {
    processArticleStorage,
    processFollowsStorage,
}