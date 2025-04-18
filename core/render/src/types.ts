import type { ArticleExtractType, GenericArticle, GenericMediaInfo, Platform } from '@idol-bbq-utils/spider/types'

type MediaInfo = GenericMediaInfo & { translation?: string; translated_by?: string }
type Article = Omit<GenericArticle<Platform>, 'media' | 'ref' | 'extra'> & {
    translation?: string
    translated_by?: string
    media: Array<MediaInfo> | null
    ref: Article | null
    extra:
        | (ArticleExtractType<Platform> & {
              translation?: string
              translated_by?: string
          })
        | null
}

export type { Article, MediaInfo }
