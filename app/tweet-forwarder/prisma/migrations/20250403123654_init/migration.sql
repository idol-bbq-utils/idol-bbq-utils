-- CreateTable
CREATE TABLE "crawler_article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "platform" INTEGER NOT NULL,
    "a_id" TEXT NOT NULL,
    "u_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "content" TEXT,
    "translation" TEXT,
    "translated_by" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref" INTEGER,
    "has_media" BOOLEAN NOT NULL,
    "media" JSONB,
    "extra" JSONB,
    "u_avatar" TEXT,
    CONSTRAINT "crawler_article_ref_fkey" FOREIGN KEY ("ref") REFERENCES "crawler_article" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "crawler_follows" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "u_id" TEXT NOT NULL,
    "platform" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "forward_by" (
    "ref_id" INTEGER NOT NULL,
    "bot_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,

    PRIMARY KEY ("ref_id", "bot_id", "task_type")
);

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_crawler_article_1" ON "crawler_article"("id");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "platform_index" ON "crawler_article"("platform");

-- CreateIndex
CREATE INDEX "platform_by_timestamp" ON "crawler_article"("platform", "created_at" DESC);

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_crawler_article_2" ON "crawler_article"("a_id", "platform");
Pragma writable_schema=0;

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_crawler_follows_1" ON "crawler_follows"("id");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "user_id_index" ON "crawler_follows"("u_id");

-- CreateIndex
CREATE INDEX "bot_id_index" ON "forward_by"("bot_id");
