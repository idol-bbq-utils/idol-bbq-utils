import type { Platform } from '@idol-bbq-utils/spider/types'

export interface ArticleLike {
    id: number
    a_id: string
    platform: Platform
    content: string
    translation?: string | null
    translated_by?: string | null
    created_at: Date | string
    sub_type?: string | null
    type?: string
    has_media?: boolean
    ref?: ArticleLike
}
