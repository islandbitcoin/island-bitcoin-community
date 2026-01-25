import { z } from 'zod';

/**
 * Game Wallet Configuration Schema
 * Defines all wallet settings for game rewards and payouts
 */
export const gameWalletConfigSchema = z.object({
  // Payout Settings
  maxDailyPayout: z.number().int().positive(),
  maxPayoutPerUser: z.number().int().positive(),
  minWithdrawal: z.number().int().positive(),
  withdrawalFee: z.number().int().nonnegative(),

  // Game Rewards (in sats)
  gameRewards: z.object({
    triviaEasy: z.number().int().nonnegative(),
    triviaMedium: z.number().int().nonnegative(),
    triviaHard: z.number().int().nonnegative(),
    dailyChallenge: z.number().int().nonnegative(),
    achievementBonus: z.number().int().nonnegative(),
    referralBonus: z.number().int().nonnegative(),
  }),

  // Anti-Abuse Settings
  rateLimits: z.object({
    triviaPerHour: z.number().int().positive(),
    withdrawalsPerDay: z.number().int().positive(),
    maxStreakBonus: z.number().int().nonnegative(),
  }),

  // Admin Settings
  adminPubkeys: z.array(z.string()),
  requireApprovalAbove: z.number().int().nonnegative(),
  maintenanceMode: z.boolean(),

  // Game Visibility Settings
  gameVisibility: z.object({
    satoshiStacker: z.boolean(),
  }),

  // Pull Payment Settings (simplified BTCPay integration)
  pullPaymentId: z.string().optional(),
  btcPayServerUrl: z.string().optional(),
  btcPayStoreId: z.string().optional(),
  btcPayApiKey: z.string().optional(),
});

export type GameWalletConfig = z.infer<typeof gameWalletConfigSchema>;

/**
 * User Balance Schema
 * Tracks user's balance and earning history
 */
export const userBalanceSchema = z.object({
  pubkey: z.string(),
  balance: z.number().int().nonnegative(),
  pendingBalance: z.number().int().nonnegative(),
  totalEarned: z.number().int().nonnegative(),
  totalWithdrawn: z.number().int().nonnegative(),
  lastActivity: z.string(),
  lastWithdrawal: z.string().optional(),
});

export type UserBalance = z.infer<typeof userBalanceSchema>;

/**
 * Game Payout Schema
 * Records individual payout transactions
 */
export const gamePayoutSchema = z.object({
  id: z.string(),
  userPubkey: z.string(),
  amount: z.number().int().positive(),
  gameType: z.enum(['trivia', 'stacker', 'achievement', 'referral', 'withdrawal']),
  timestamp: z.string(),
  status: z.enum(['pending', 'paid', 'failed']),
  pullPaymentId: z.string().optional(),
});

export type GamePayout = z.infer<typeof gamePayoutSchema>;
