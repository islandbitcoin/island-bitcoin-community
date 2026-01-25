import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { payouts } from '../db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import type { LeaderboardEntry } from '@island-bitcoin/shared';

const timeframeSchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'alltime']).optional().default('alltime'),
});

export const leaderboardRoute = new Hono();

leaderboardRoute.get(
  '/',
  zValidator('query', timeframeSchema),
  async (c) => {
    const { timeframe } = c.req.valid('query');

    const startTime = getStartTime(timeframe);

    const scoreColumn = sql<number>`CAST(SUM(${payouts.amount}) AS INTEGER)`.as('score');
    const gameCountColumn = sql<number>`CAST(COUNT(*) AS INTEGER)`.as('game_count');

    const results = await db
      .select({
        pubkey: payouts.userId,
        score: scoreColumn,
        gameCount: gameCountColumn,
      })
      .from(payouts)
      .where(
        and(
          eq(payouts.status, 'paid'),
          sql`${payouts.gameType} != 'withdrawal'`,
          startTime ? gte(payouts.timestamp, startTime) : undefined
        )
      )
      .groupBy(payouts.userId)
      .orderBy(desc(scoreColumn))
      .limit(10);

    const leaderboard: LeaderboardEntry[] = results.map((row) => ({
      pubkey: row.pubkey,
      score: row.score,
      gameCount: row.gameCount,
    }));

    return c.json(leaderboard);
  }
);

function getStartTime(timeframe: 'daily' | 'weekly' | 'alltime'): string | null {
  if (timeframe === 'alltime') {
    return null;
  }

  const now = new Date();

  if (timeframe === 'daily') {
    const startOfDay = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    return startOfDay.toISOString();
  }

  if (timeframe === 'weekly') {
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - dayOfWeek,
      0, 0, 0, 0
    ));
    return startOfWeek.toISOString();
  }

  return null;
}
