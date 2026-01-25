/**
 * Drizzle ORM Schema for Island Bitcoin Community Database
 * 
 * SQLite database schema with 7 tables:
 * - users: User accounts with pubkey authentication
 * - balances: User balance tracking
 * - payouts: Transaction history
 * - trivia_progress: Trivia game progress
 * - achievements: User achievements
 * - referrals: Referral tracking
 * - config: Application configuration
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users Table
 * Primary user accounts identified by Nostr pubkey
 */
export const users = sqliteTable('users', {
  pubkey: text('pubkey').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  lightningAddress: text('lightning_address'),
}, (table) => ({
  createdAtIdx: index('users_created_at_idx').on(table.createdAt),
}));

/**
 * Balances Table
 * Tracks user balance and earning/withdrawal totals
 * One-to-one relationship with users
 */
export const balances = sqliteTable('balances', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  pending: integer('pending').notNull().default(0),
  totalEarned: integer('total_earned').notNull().default(0),
  totalWithdrawn: integer('total_withdrawn').notNull().default(0),
  lastActivity: text('last_activity').notNull().default(sql`(datetime('now'))`),
  lastWithdrawal: text('last_withdrawal'),
}, (table) => ({
  userIdIdx: index('balances_user_id_idx').on(table.userId),
}));

/**
 * Payouts Table
 * Records all payout transactions (earnings and withdrawals)
 */
export const payouts = sqliteTable('payouts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  gameType: text('game_type', { 
    enum: ['trivia', 'stacker', 'achievement', 'referral', 'withdrawal'] 
  }).notNull(),
  status: text('status', { 
    enum: ['pending', 'paid', 'failed'] 
  }).notNull().default('pending'),
  timestamp: text('timestamp').notNull().default(sql`(datetime('now'))`),
  txId: text('tx_id'),
  pullPaymentId: text('pull_payment_id'),
}, (table) => ({
  userIdIdx: index('payouts_user_id_idx').on(table.userId),
  statusIdx: index('payouts_status_idx').on(table.status),
  timestampIdx: index('payouts_timestamp_idx').on(table.timestamp),
  gameTypeIdx: index('payouts_game_type_idx').on(table.gameType),
}));

/**
 * Trivia Progress Table
 * Tracks user progress in trivia game
 * One-to-one relationship with users
 */
export const triviaProgress = sqliteTable('trivia_progress', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  questionsAnswered: text('questions_answered', { mode: 'json' })
    .notNull()
    .default(sql`'[]'`)
    .$type<string[]>(),
  correct: integer('correct').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  satsEarned: integer('sats_earned').notNull().default(0),
  lastPlayedDate: text('last_played_date'),
  levelCompleted: integer('level_completed', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  userIdIdx: index('trivia_progress_user_id_idx').on(table.userId),
  levelIdx: index('trivia_progress_level_idx').on(table.level),
}));

/**
 * Achievements Table
 * Records unlocked achievements for users
 */
export const achievements = sqliteTable('achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  achievementType: text('achievement_type').notNull(),
  unlockedAt: text('unlocked_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  userIdIdx: index('achievements_user_id_idx').on(table.userId),
  achievementTypeIdx: index('achievements_type_idx').on(table.achievementType),
  unlockedAtIdx: index('achievements_unlocked_at_idx').on(table.unlockedAt),
}));

/**
 * Referrals Table
 * Tracks referral relationships and bonus status
 */
export const referrals = sqliteTable('referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerId: text('referrer_id')
    .notNull()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  refereeId: text('referee_id')
    .notNull()
    .references(() => users.pubkey, { onDelete: 'cascade' }),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  bonusPaid: integer('bonus_paid', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  referrerIdIdx: index('referrals_referrer_id_idx').on(table.referrerId),
  refereeIdIdx: index('referrals_referee_id_idx').on(table.refereeId),
  completedIdx: index('referrals_completed_idx').on(table.completed),
}));

/**
 * Config Table
 * Stores application configuration as key-value pairs
 */
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  keyIdx: index('config_key_idx').on(table.key),
}));

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Balance = typeof balances.$inferSelect;
export type NewBalance = typeof balances.$inferInsert;

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;

export type TriviaProgress = typeof triviaProgress.$inferSelect;
export type NewTriviaProgress = typeof triviaProgress.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
