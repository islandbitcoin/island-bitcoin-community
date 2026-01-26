import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { users, balances, payouts, referrals } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

export const achievementsRoute = new Hono();

achievementsRoute.get('/', requireAuth, async (c) => {
  const pubkey = c.get('pubkey');

  const userAchievements = await db.query.achievements.findMany({
    where: (achievements, { eq }) => eq(achievements.userId, pubkey),
    orderBy: (achievements, { desc }) => [desc(achievements.unlockedAt)],
  });

  const response = userAchievements.map((achievement) => ({
    type: achievement.achievementType,
    unlockedAt: achievement.unlockedAt,
  }));

  return c.json(response);
});

const referralCheckSchema = z.object({
  referrerId: z.string(),
});

achievementsRoute.post(
  '/referral/check',
  requireAuth,
  zValidator('json', referralCheckSchema),
  async (c) => {
    const refereePubkey = c.get('pubkey');
    const { referrerId } = c.req.valid('json');

    let referral = await db.query.referrals.findFirst({
      where: (referrals, { eq, and }) =>
        and(
          eq(referrals.referrerId, referrerId),
          eq(referrals.refereeId, refereePubkey)
        ),
    });

    if (referral && referral.bonusPaid) {
      return c.json({ bonusPaid: false });
    }

    const gamePayouts = await db.query.payouts.findFirst({
      where: (payouts, { eq, and, or }) =>
        and(
          eq(payouts.userId, refereePubkey),
          or(
            eq(payouts.gameType, 'trivia'),
            eq(payouts.gameType, 'stacker')
          ),
          eq(payouts.status, 'paid')
        ),
    });

    const isComplete = !!gamePayouts;

    if (!isComplete) {
      return c.json({ bonusPaid: false });
    }

    const bonusAmount = 100;

    let referrerBalance = await db.query.balances.findFirst({
      where: (balances, { eq }) => eq(balances.userId, referrerId),
    });

    if (!referrerBalance) {
      const referrerUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.pubkey, referrerId),
      });

      if (!referrerUser) {
        await db.insert(users).values({ pubkey: referrerId });
      }

      await db.insert(balances).values({
        userId: referrerId,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      referrerBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, referrerId),
      });
    }

    const payoutId = randomUUID();
    const now = new Date().toISOString();

    await db.insert(payouts).values({
      id: payoutId,
      userId: referrerId,
      amount: bonusAmount,
      gameType: 'referral',
      status: 'paid',
      timestamp: now,
    });

    await db.update(balances)
      .set({
        balance: referrerBalance!.balance + bonusAmount,
        totalEarned: referrerBalance!.totalEarned + bonusAmount,
        lastActivity: now,
      })
      .where(eq(balances.userId, referrerId));

    if (!referral) {
      await db.insert(referrals).values({
        referrerId,
        refereeId: refereePubkey,
        completed: true,
        bonusPaid: true,
      });
    } else {
      await db.update(referrals)
        .set({
          completed: true,
          bonusPaid: true,
        })
        .where(
          and(
            eq(referrals.referrerId, referrerId),
            eq(referrals.refereeId, refereePubkey)
          )
        );
    }

    return c.json({ bonusPaid: true, amount: bonusAmount });
  }
);
