import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { referrals, achievementDefinitions } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';
import { creditReward } from '../services/rewards';

export const achievementsRoute = new Hono();

achievementsRoute.get('/definitions', async (c) => {
  const definitions = await db
    .select()
    .from(achievementDefinitions)
    .where(eq(achievementDefinitions.active, true))
    .all();

  return c.json(definitions);
});

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
      where: (payouts, { eq, and }) =>
        and(
          eq(payouts.userId, refereePubkey),
          eq(payouts.gameType, 'trivia'),
          eq(payouts.status, 'paid')
        ),
    });

    const isComplete = !!gamePayouts;

    if (!isComplete) {
      return c.json({ bonusPaid: false });
    }

    const bonusAmount = 100;

    await creditReward(referrerId, bonusAmount, 'referral');

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
