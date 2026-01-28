CREATE TABLE IF NOT EXISTS `crawler_article` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` integer NOT NULL,
	`a_id` text NOT NULL,
	`u_id` text NOT NULL,
	`username` text NOT NULL,
	`created_at` integer NOT NULL,
	`content` text,
	`translation` text,
	`translated_by` text,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`ref` integer,
	`has_media` integer NOT NULL,
	`media` text,
	`extra` text,
	`u_avatar` text,
	FOREIGN KEY (`ref`) REFERENCES `crawler_article`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `crawler_follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`u_id` text NOT NULL,
	`platform` integer NOT NULL,
	`followers` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `forward_by` (
	`ref_id` integer NOT NULL,
	`bot_id` text NOT NULL,
	`task_type` text NOT NULL,
	PRIMARY KEY(`ref_id`, `bot_id`, `task_type`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `crawler_article_a_id_platform_unique` ON `crawler_article` (`a_id`,`platform`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_index` ON `crawler_article` (`platform`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_by_timestamp` ON `crawler_article` (`platform`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_id_index` ON `crawler_follows` (`u_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bot_id_index` ON `forward_by` (`bot_id`);