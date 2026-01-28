// src/schema/types.ts
export type DbDialect = 'sqlite' | 'pg'

// Domain types - will be re-exported from dialect-specific schema files
export interface ArticleBase {
    id: number
    platform: number
    a_id: string
    u_id: string
    username: string
    created_at: number
    content: string | null
    translation: string | null
    translated_by: string | null
    url: string
    type: string
    ref: number | null
    has_media: boolean
    media: unknown | null
    extra: unknown | null
    u_avatar: string | null
}

export interface FollowBase {
    id: number
    username: string
    u_id: string
    platform: number
    followers: number
    created_at: number
}

export interface SendByBase {
    ref_id: number
    sender_id: string
    task_type: string
}
