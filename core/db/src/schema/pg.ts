import {
    pgTable,
    serial,
    integer,
    text,
    boolean,
    jsonb,
    index,
    unique,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core'
import { Platform } from '../../../spider/src/types'

export const article = pgTable(
    'article',
    {
        id: serial('id').primaryKey(),
        platform: integer('platform').notNull(),
        a_id: text('a_id').notNull(),
        u_id: text('u_id').notNull(),
        username: text('username').notNull(),
        created_at: integer('created_at').notNull(),
        content: text('content'),
        translation: text('translation'),
        translated_by: text('translated_by'),
        url: text('url').notNull(),
        type: text('type').notNull(),
        ref: integer('ref').references((): any => article.id, {
            onDelete: 'no action',
            onUpdate: 'no action',
        }),
        has_media: boolean('has_media').notNull(),
        media: jsonb('media'),
        extra: jsonb('extra'),
        u_avatar: text('u_avatar'),
    },
    (table) => [
        unique('article_a_id_platform_unique').on(table.a_id, table.platform),
        index('platform_index').on(table.platform),
        index('platform_by_timestamp').on(table.platform, table.created_at),
    ],
)

export const follow = pgTable(
    'follow',
    {
        id: serial('id').primaryKey(),
        username: text('username').notNull(),
        u_id: text('u_id').notNull(),
        platform: integer('platform').notNull(),
        followers: integer('followers').notNull(),
        created_at: integer('created_at').notNull(),
    },
    (table) => [index('user_id_index').on(table.u_id)],
)

export const sendBy = pgTable(
    'send_by',
    {
        ref_id: integer('ref_id').notNull(),
        sender_id: text('sender_id').notNull(),
        task_type: text('task_type').notNull(),
    },
    (table) => [
        unique('send_by_pk').on(table.ref_id, table.sender_id, table.task_type),
        index('sender_id_index').on(table.sender_id),
    ],
)

export type Article = typeof article.$inferSelect
export type NewArticle = typeof article.$inferInsert

export type Follow = typeof follow.$inferSelect
export type NewFollow = typeof follow.$inferInsert

export type SendBy = typeof sendBy.$inferSelect
export type NewSendBy = typeof sendBy.$inferInsert

export const pgAccount = pgTable(
    'account',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull().unique(),
        platform: integer('platform').notNull(),
        cookie_string: text('cookie_string'),
        status: text('status').default('active').notNull(),
        last_used_at: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
        is_encrypted: boolean('is_encrypted').default(false).notNull(),
        failure_count: integer('failure_count').default(0).notNull(),
        last_failure_at: timestamp('last_failure_at', { withTimezone: true }),
        ban_until: timestamp('ban_until', { withTimezone: true }),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => {
        return {
            nameIdx: uniqueIndex('name_idx').on(table.name),
            platformNameIdx: uniqueIndex('platform_name_idx').on(table.platform, table.name),
        }
    },
)

export type Account = typeof pgAccount.$inferSelect
export type NewAccount = typeof pgAccount.$inferInsert

export function platformToString(platform: Platform): string {
    return Platform[platform]
}

export function stringToPlatform(platformStr: string): Platform {
    return Platform[platformStr as keyof typeof Platform]
}
