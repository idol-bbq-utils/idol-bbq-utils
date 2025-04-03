-- CreateTable
CREATE TABLE "x_forward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ref" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    CONSTRAINT "x_forward_ref_fkey" FOREIGN KEY ("ref") REFERENCES "x_tweet" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "x_tweet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "u_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tweet_link" TEXT DEFAULT '',
    "has_media" BOOLEAN,
    "ref" INTEGER,
    "translation" TEXT,
    "extra" JSONB,
    CONSTRAINT "x_tweet_ref_fkey" FOREIGN KEY ("ref") REFERENCES "x_tweet" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "x_follows" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "u_id" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "follows" INTEGER
);

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_x_forward_1" ON "x_forward"("id");
Pragma writable_schema=0;

-- CreateIndex
CREATE UNIQUE INDEX "forward_by" ON "x_forward"("ref", "username");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_x_tweet_1" ON "x_tweet"("id");
Pragma writable_schema=0;

-- CreateIndex
CREATE UNIQUE INDEX "article" ON "x_tweet"("u_id", "timestamp" DESC);

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_x_follows_1" ON "x_follows"("id");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "follows_for_user" ON "x_follows"("u_id" DESC);
