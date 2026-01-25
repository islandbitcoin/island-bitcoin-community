import { z } from 'zod';

/**
 * Leaderboard Entry Schema
 * Represents a single entry in the game leaderboard
 */
export const leaderboardEntrySchema = z.object({
  pubkey: z.string(),
  score: z.number().int().nonnegative(),
  gameCount: z.number().int().nonnegative(),
  rank: z.number().int().positive().optional(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
