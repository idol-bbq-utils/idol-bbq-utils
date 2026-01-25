-- Rename tables and columns
-- This migration renames tables and columns for better naming consistency

-- Rename crawler_article to article
ALTER TABLE "crawler_article" RENAME TO "article";

-- Rename crawler_follows to follow
ALTER TABLE "crawler_follows" RENAME TO "follow";

-- Rename forward_by to send_by
ALTER TABLE "forward_by" RENAME TO "send_by";

-- Rename bot_id column to sender_id in send_by table
-- SQLite doesn't support ALTER COLUMN RENAME directly, so we need to recreate the table

-- Step 1: Create new table with correct schema
CREATE TABLE "send_by_new" (
    "ref_id" INTEGER NOT NULL,
    "sender_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,

    PRIMARY KEY ("ref_id", "sender_id", "task_type")
);

-- Step 2: Copy data from old table to new table
INSERT INTO "send_by_new" ("ref_id", "sender_id", "task_type")
SELECT "ref_id", "bot_id", "task_type" FROM "send_by";

-- Step 3: Drop old table
DROP TABLE "send_by";

-- Step 4: Rename new table to final name
ALTER TABLE "send_by_new" RENAME TO "send_by";

-- Step 5: Recreate index with new column name
CREATE INDEX "sender_id_index" ON "send_by"("sender_id");

-- Update unique index names for article table
DROP INDEX IF EXISTS "sqlite_autoindex_crawler_article_1";
DROP INDEX IF EXISTS "sqlite_autoindex_crawler_article_2";

Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_article_1" ON "article"("id");
Pragma writable_schema=0;

Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_article_2" ON "article"("a_id", "platform");
Pragma writable_schema=0;

-- Update unique index name for follow table
DROP INDEX IF EXISTS "sqlite_autoindex_crawler_follows_1";

Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_follow_1" ON "follow"("id");
Pragma writable_schema=0;
