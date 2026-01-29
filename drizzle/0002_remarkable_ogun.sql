CREATE TABLE `achievement_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`criteria` text NOT NULL,
	`reward` integer DEFAULT 0 NOT NULL,
	`icon` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievement_definitions_type_unique` ON `achievement_definitions` (`type`);