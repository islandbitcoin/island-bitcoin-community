CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`correct_answer` integer NOT NULL,
	`explanation` text NOT NULL,
	`difficulty` text NOT NULL,
	`category` text NOT NULL,
	`level` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
DELETE FROM trivia_progress;