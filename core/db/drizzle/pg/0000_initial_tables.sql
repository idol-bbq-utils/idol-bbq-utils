CREATE TABLE "article" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" integer NOT NULL,
	"a_id" text NOT NULL,
	"u_id" text NOT NULL,
	"username" text NOT NULL,
	"created_at" integer NOT NULL,
	"content" text,
	"translation" text,
	"translated_by" text,
	"url" text NOT NULL,
	"type" text NOT NULL,
	"ref" integer,
	"has_media" boolean NOT NULL,
	"media" jsonb,
	"extra" jsonb,
	"u_avatar" text,
	CONSTRAINT "article_a_id_platform_unique" UNIQUE("a_id","platform")
);
--> statement-breakpoint
CREATE TABLE "follow" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"u_id" text NOT NULL,
	"platform" integer NOT NULL,
	"followers" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_by" (
	"ref_id" integer NOT NULL,
	"sender_id" text NOT NULL,
	"task_type" text NOT NULL,
	CONSTRAINT "send_by_pk" UNIQUE("ref_id","sender_id","task_type")
);
--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_ref_article_id_fk" FOREIGN KEY ("ref") REFERENCES "public"."article"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_index" ON "article" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "platform_by_timestamp" ON "article" USING btree ("platform","created_at");--> statement-breakpoint
CREATE INDEX "user_id_index" ON "follow" USING btree ("u_id");--> statement-breakpoint
CREATE INDEX "sender_id_index" ON "send_by" USING btree ("sender_id");