import type { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm'
import type * as sqliteSchema from '../schema/sqlite'

export type SharedSchema = typeof sqliteSchema

export interface GenericRelationalQueryBuilder<
    TSchema extends TablesRelationalConfig,
    TTableConfig extends TablesRelationalConfig[string],
> {
    findMany<TSelection extends DBQueryConfig<'many', true, TSchema, TTableConfig>>(
        config?: TSelection,
    ): Promise<BuildQueryResult<TSchema, TTableConfig, TSelection>[]>

    findFirst<TSelection extends Omit<DBQueryConfig<'many', true, TSchema, TTableConfig>, 'limit'>>(
        config?: TSelection,
    ): Promise<BuildQueryResult<TSchema, TTableConfig, TSelection> | undefined>
}

export type GenericQuery<TFullSchema extends Record<string, unknown>> = {
    [K in keyof ExtractTablesWithRelations<TFullSchema>]: GenericRelationalQueryBuilder<
        ExtractTablesWithRelations<TFullSchema>,
        ExtractTablesWithRelations<TFullSchema>[K]
    >
}

export type SharedQuery = GenericQuery<SharedSchema>
