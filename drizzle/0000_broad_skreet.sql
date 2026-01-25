CREATE TABLE `achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`achievement_type` text NOT NULL,
	`unlocked_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `achievements_user_id_idx` ON `achievements` (`user_id`);--> statement-breakpoint
CREATE INDEX `achievements_type_idx` ON `achievements` (`achievement_type`);--> statement-breakpoint
CREATE INDEX `achievements_unlocked_at_idx` ON `achievements` (`unlocked_at`);--> statement-breakpoint
CREATE TABLE `balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`pending` integer DEFAULT 0 NOT NULL,
	`total_earned` integer DEFAULT 0 NOT NULL,
	`total_withdrawn` integer DEFAULT 0 NOT NULL,
	`last_activity` text DEFAULT (datetime('now')) NOT NULL,
	`last_withdrawal` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `balances_user_id_idx` ON `balances` (`user_id`);--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_key_idx` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`game_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL,
	`tx_id` text,
	`pull_payment_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payouts_user_id_idx` ON `payouts` (`user_id`);--> statement-breakpoint
CREATE INDEX `payouts_status_idx` ON `payouts` (`status`);--> statement-breakpoint
CREATE INDEX `payouts_timestamp_idx` ON `payouts` (`timestamp`);--> statement-breakpoint
CREATE INDEX `payouts_game_type_idx` ON `payouts` (`game_type`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referrer_id` text NOT NULL,
	`referee_id` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`bonus_paid` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`referrer_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referee_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `referrals_referrer_id_idx` ON `referrals` (`referrer_id`);--> statement-breakpoint
CREATE INDEX `referrals_referee_id_idx` ON `referrals` (`referee_id`);--> statement-breakpoint
CREATE INDEX `referrals_completed_idx` ON `referrals` (`completed`);--> statement-breakpoint
CREATE TABLE `trivia_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`questions_answered` text DEFAULT '[]' NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`sats_earned` integer DEFAULT 0 NOT NULL,
	`last_played_date` text,
	`level_completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`pubkey`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trivia_progress_user_id_idx` ON `trivia_progress` (`user_id`);--> statement-breakpoint
CREATE INDEX `trivia_progress_level_idx` ON `trivia_progress` (`level`);--> statement-breakpoint
CREATE TABLE `users` (
	`pubkey` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`lightning_address` text
);
--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);