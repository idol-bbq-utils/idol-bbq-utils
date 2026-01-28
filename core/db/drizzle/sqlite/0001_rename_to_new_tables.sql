ALTER TABLE `crawler_article` RENAME TO `article`;--> statement-breakpoint
ALTER TABLE `crawler_follows` RENAME TO `follow`;--> statement-breakpoint
ALTER TABLE `forward_by` RENAME TO `send_by`;--> statement-breakpoint
ALTER TABLE `send_by` RENAME COLUMN "bot_id" TO "sender_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_article` (
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
	FOREIGN KEY (`ref`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_article`("id", "platform", "a_id", "u_id", "username", "created_at", "content", "translation", "translated_by", "url", "type", "ref", "has_media", "media", "extra", "u_avatar") SELECT "id", "platform", "a_id", "u_id", "username", "created_at", "content", "translation", "translated_by", "url", "type", "ref", "has_media", "media", "extra", "u_avatar" FROM `article`;--> statement-breakpoint
DROP TABLE `article`;--> statement-breakpoint
ALTER TABLE `__new_article` RENAME TO `article`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `platform_index` ON `article` (`platform`);--> statement-breakpoint
CREATE INDEX `platform_by_timestamp` ON `article` (`platform`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `article_a_id_platform_unique` ON `article` (`a_id`,`platform`);--> statement-breakpoint
DROP INDEX `bot_id_index`;--> statement-breakpoint
CREATE TABLE `__new_send_by` (
	`ref_id` integer NOT NULL,
	`sender_id` text NOT NULL,
	`task_type` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_send_by`("ref_id", "sender_id", "task_type") SELECT "ref_id", "sender_id", "task_type" FROM `send_by`;--> statement-breakpoint
DROP TABLE `send_by`;--> statement-breakpoint
ALTER TABLE `__new_send_by` RENAME TO `send_by`;--> statement-breakpoint
CREATE INDEX `sender_id_index` ON `send_by` (`sender_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `send_by_pk` ON `send_by` (`ref_id`,`sender_id`,`task_type`);