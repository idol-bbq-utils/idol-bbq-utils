CREATE TABLE "account" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" integer NOT NULL,
	"cookie_string" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp with time zone,
	"ban_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "name_idx" ON "account" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_name_idx" ON "account" USING btree ("platform","name");