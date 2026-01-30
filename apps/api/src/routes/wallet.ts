import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { users, balances, payouts } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { randomUUID } from 'node:crypto';
import { eq, and, gte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { UserBalance, GamePayout } from '@island-bitcoin/shared';
import { sendPayment } from '../services/flash';

export const walletRoute = new Hono();

walletRoute.get('/balance', requireAuth, async (c) => {
  const pubkey = c.get('pubkey');

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

  const userBalance: UserBalance = {
    pubkey,
    balance: balance!.balance,
    pendingBalance: balance!.pending,
    totalEarned: balance!.totalEarned,
    totalWithdrawn: balance!.totalWithdrawn,
    lastActivity: balance!.lastActivity,
  };

  return c.json(userBalance);
});

const awardSchema = z.object({
  userId: z.string(),
  amount: z.number().int().positive(),
  gameType: z.enum(['trivia', 'stacker', 'achievement']),
});

walletRoute.post(
  '/award',
  requireAuth,
  requireAdmin,
  zValidator('json', awardSchema),
  async (c) => {
    const { userId, amount, gameType } = c.req.valid('json');

    let balance = await db.query.balances.findFirst({
      where: (balances, { eq }) => eq(balances.userId, userId),
    });

    if (!balance) {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.pubkey, userId),
      });

      if (!user) {
        await db.insert(users).values({ pubkey: userId });
      }

      await db.insert(balances).values({
        userId,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      balance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, userId),
      });
    }

    const payoutId = randomUUID();
    const now = new Date().toISOString();

    await db.insert(payouts).values({
      id: payoutId,
      userId,
      amount,
      gameType,
      status: 'paid',
      timestamp: now,
    });

    await db.update(balances)
      .set({
        balance: balance!.balance + amount,
        totalEarned: balance!.totalEarned + amount,
        lastActivity: now,
      })
      .where(eq(balances.userId, userId));

    const updatedBalance = await db.query.balances.findFirst({
      where: (balances, { eq }) => eq(balances.userId, userId),
    });

    const userBalance: UserBalance = {
      pubkey: userId,
      balance: updatedBalance!.balance,
      pendingBalance: updatedBalance!.pending,
      totalEarned: updatedBalance!.totalEarned,
      totalWithdrawn: updatedBalance!.totalWithdrawn,
      lastActivity: updatedBalance!.lastActivity,
    };

    return c.json(userBalance);
  }
);

const withdrawSchema = z.object({
  amount: z.number().int().positive(),
  lightningAddress: z.string().email(),
});

walletRoute.post(
  '/withdraw',
  requireAuth,
  zValidator('json', withdrawSchema),
  async (c) => {
    const pubkey = c.get('pubkey');
    const { amount, lightningAddress } = c.req.valid('json');

    await db.update(users)
      .set({ lightningAddress })
      .where(eq(users.pubkey, pubkey));

    const withdrawalMinConfig = await db.query.config.findFirst({
      where: (config, { eq }) => eq(config.key, 'withdrawal_min'),
    });

    const withdrawalMin = withdrawalMinConfig ? parseInt(withdrawalMinConfig.value, 10) : 100;

    if (amount < withdrawalMin) {
      throw new HTTPException(400, { message: `Minimum withdrawal is ${withdrawalMin} sats` });
    }

    const now = new Date();
    const startOfDayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    const withdrawalCountToday = await db
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.userId, pubkey),
          eq(payouts.gameType, 'withdrawal'),
          gte(payouts.timestamp, startOfDayUTC.toISOString())
        )
      )
      .all();

    if (withdrawalCountToday.length >= 10) {
      throw new HTTPException(429, { message: 'Maximum 10 withdrawals per day' });
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

    if (balance!.balance < amount) {
      throw new HTTPException(400, { message: 'Insufficient balance' });
    }

    const payoutId = randomUUID();
    const nowISO = new Date().toISOString();

    await db.insert(payouts).values({
      id: payoutId,
      userId: pubkey,
      amount,
      gameType: 'withdrawal',
      status: 'pending',
      timestamp: nowISO,
    });

    await db.update(balances)
      .set({
        balance: balance!.balance - amount,
        pending: balance!.pending + amount,
        totalWithdrawn: balance!.totalWithdrawn + amount,
        lastActivity: nowISO,
      })
      .where(eq(balances.userId, pubkey));

    const AUTO_PROCESS_THRESHOLD = 1000;

    if (amount < AUTO_PROCESS_THRESHOLD) {
      const flashTokenConfig = await db.query.config.findFirst({
        where: (config, { eq }) => eq(config.key, 'ory_token'),
      });

      if (flashTokenConfig?.value) {
        try {
          const result = await sendPayment(lightningAddress, amount, flashTokenConfig.value);
          if (result.success) {
            await db.update(payouts)
              .set({ status: 'paid', txId: result.paymentHash || null })
              .where(eq(payouts.id, payoutId));
            await db.update(balances)
              .set({ pending: sql`pending - ${amount}` })
              .where(eq(balances.userId, pubkey));
          }
        } catch {
          // Leave as pending — admin will process manually
        }
      }
    }

    const updatedBalance = await db.query.balances.findFirst({
      where: (balances, { eq }) => eq(balances.userId, pubkey),
    });

    const userBalance: UserBalance = {
      pubkey,
      balance: updatedBalance!.balance,
      pendingBalance: updatedBalance!.pending,
      totalEarned: updatedBalance!.totalEarned,
      totalWithdrawn: updatedBalance!.totalWithdrawn,
      lastActivity: updatedBalance!.lastActivity,
    };

    return c.json(userBalance);
  }
);

const payoutsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

walletRoute.get(
  '/payouts',
  requireAuth,
  zValidator('query', payoutsQuerySchema),
  async (c) => {
    const pubkey = c.get('pubkey');
    let { limit, offset } = c.req.valid('query');

    limit = Math.min(limit, 100);

    const userPayouts = await db.query.payouts.findMany({
      where: (payouts, { eq }) => eq(payouts.userId, pubkey),
      orderBy: (payouts, { desc }) => [desc(payouts.timestamp)],
      limit,
      offset,
    });

    const totalResult = await db
      .select()
      .from(payouts)
      .where(eq(payouts.userId, pubkey))
      .all();

    const total = totalResult.length;

    const mappedPayouts: GamePayout[] = userPayouts.map((p) => ({
      id: p.id,
      userPubkey: p.userId,
      amount: p.amount,
      gameType: p.gameType,
      timestamp: p.timestamp,
      status: p.status,
      pullPaymentId: p.pullPaymentId || undefined,
    }));

    const response = {
      payouts: mappedPayouts,
      pagination: {
        limit,
        offset,
        total,
      },
    };

    return c.json(response);
  }
);
