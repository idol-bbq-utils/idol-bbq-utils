import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/schema/pg.ts',
    out: './drizzle/pg',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/idolbbq',
    },
    verbose: true,
    strict: true,
})
