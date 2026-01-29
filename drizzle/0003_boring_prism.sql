CREATE TABLE `trivia_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`level` integer NOT NULL,
	`question_ids` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	`completed_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
