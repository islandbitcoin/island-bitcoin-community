import { Hono } from 'hono';
import { db } from '../db';
import { users, balances, payouts } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { randomUUID } from 'node:crypto';
import { eq, and, gte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

export const stackerRoute = new Hono();

stackerRoute.post('/claim', requireAuth, async (c) => {
  const pubkey = c.get('pubkey');

  const stackerDailyLimitConfig = await db.query.config.findFirst({
    where: (config, { eq }) => eq(config.key, 'stackerDailyLimit'),
  });

  const stackerDailyLimit = stackerDailyLimitConfig 
    ? parseInt(stackerDailyLimitConfig.value, 10) 
    : 10;

  const stackerRewardConfig = await db.query.config.findFirst({
    where: (config, { eq }) => eq(config.key, 'stackerReward'),
  });

  const stackerReward = stackerRewardConfig 
    ? parseInt(stackerRewardConfig.value, 10) 
    : 5;

  const now = new Date();
  const startOfDayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));

  const claimsToday = await db
    .select()
    .from(payouts)
    .where(
      and(
        eq(payouts.userId, pubkey),
        eq(payouts.gameType, 'stacker'),
        gte(payouts.timestamp, startOfDayUTC.toISOString())
      )
    )
    .all();

  if (claimsToday.length >= stackerDailyLimit) {
    throw new HTTPException(429, { 
      message: `Maximum ${stackerDailyLimit} claims per day` 
    });
  }

  let balance = await db.query.balances.findFirst({
    where: (balances, { eq }) => eq(balances.userId, pubkey),
  });

  if (!balance) {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.pubkey, pubkey),
    });

    if (!user) {
      await db.insert(users).values({ pubkey });
    }

    await db.insert(balances).values({
      userId: pubkey,
      balance: 0,
      pending: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });

    balance = await db.query.balances.findFirst({
      where: (balances, { eq }) => eq(balances.userId, pubkey),
    });
  }

  const payoutId = randomUUID();
  const nowISO = new Date().toISOString();

  await db.insert(payouts).values({
    id: payoutId,
    userId: pubkey,
    amount: stackerReward,
    gameType: 'stacker',
    status: 'paid',
    timestamp: nowISO,
  });

  await db.update(balances)
    .set({
      balance: balance!.balance + stackerReward,
      totalEarned: balance!.totalEarned + stackerReward,
      lastActivity: nowISO,
    })
    .where(eq(balances.userId, pubkey));

  const claimsRemaining = stackerDailyLimit - (claimsToday.length + 1);

  const response = {
    satsEarned: stackerReward,
    claimsRemaining,
  };

  return c.json(response);
});
