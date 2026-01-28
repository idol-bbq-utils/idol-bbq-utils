-- Disable foreign key constraints temporarily
PRAGMA foreign_keys=OFF;--> statement-breakpoint

CREATE TABLE `article` (
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
);--> statement-breakpoint

INSERT INTO `article` SELECT * FROM `crawler_article`;--> statement-breakpoint

DROP TABLE `crawler_article`;--> statement-breakpoint

CREATE UNIQUE INDEX `article_a_id_platform_unique` ON `article`(`a_id`, `platform`);--> statement-breakpoint
CREATE INDEX `platform_index` ON `article`(`platform`);--> statement-breakpoint
CREATE INDEX `platform_by_timestamp` ON `article`(`platform`, `created_at`);--> statement-breakpoint

CREATE TABLE `follow` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`u_id` text NOT NULL,
	`platform` integer NOT NULL,
	`followers` integer NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint

INSERT INTO `follow` SELECT * FROM `crawler_follows`;--> statement-breakpoint

DROP TABLE `crawler_follows`;--> statement-breakpoint

CREATE INDEX `user_id_index` ON `follow`(`u_id`);--> statement-breakpoint

CREATE TABLE `send_by` (
	`ref_id` integer NOT NULL,
	`sender_id` text NOT NULL,
	`task_type` text NOT NULL,
	PRIMARY KEY(`ref_id`, `sender_id`, `task_type`)
);--> statement-breakpoint

INSERT INTO `send_by` (`ref_id`, `sender_id`, `task_type`)
SELECT `ref_id`, `bot_id`, `task_type` FROM `forward_by`;--> statement-breakpoint

DROP TABLE `forward_by`;--> statement-breakpoint

CREATE INDEX `sender_id_index` ON `send_by` (`sender_id`);--> statement-breakpoint

-- Re-enable foreign key constraints
PRAGMA foreign_keys=ON;