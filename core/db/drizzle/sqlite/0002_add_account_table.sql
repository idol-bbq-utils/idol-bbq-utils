CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`platform` integer NOT NULL,
	`cookie_string` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_used_at` integer NOT NULL,
	`is_encrypted` integer DEFAULT false NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_failure_at` integer,
	`ban_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_name_unique` ON `account` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `name_idx` ON `account` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `platform_name_idx` ON `account` (`platform`,`name`);