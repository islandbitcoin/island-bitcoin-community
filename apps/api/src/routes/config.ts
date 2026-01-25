import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { config } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const configRoute = new Hono();

const SENSITIVE_FIELDS = ['ory_token', 'btcPayApiKey'];

const VALID_CONFIG_KEYS = new Set([
  'maxDailyPayout',
  'maxPayoutPerUser',
  'minWithdrawal',
  'withdrawalFee',
  'triviaEasy',
  'triviaMedium',
  'triviaHard',
  'dailyChallenge',
  'achievementBonus',
  'referralBonus',
  'triviaPerHour',
  'withdrawalsPerDay',
  'maxStreakBonus',
  'adminPubkeys',
  'requireApprovalAbove',
  'maintenanceMode',
  'satoshiStacker',
  'pullPaymentId',
  'btcPayServerUrl',
  'btcPayStoreId',
  'btcPayApiKey',
]);

const DEFAULT_CONFIG: Record<string, string> = {
  maxDailyPayout: '10000',
  maxPayoutPerUser: '5000',
  minWithdrawal: '100',
  withdrawalFee: '0',
  triviaEasy: '10',
  triviaMedium: '25',
  triviaHard: '50',
  dailyChallenge: '100',
  achievementBonus: '50',
  referralBonus: '100',
  triviaPerHour: '10',
  withdrawalsPerDay: '5',
  maxStreakBonus: '500',
  adminPubkeys: '[]',
  requireApprovalAbove: '0',
  maintenanceMode: 'false',
  satoshiStacker: 'true',
  pullPaymentId: '',
  btcPayServerUrl: '',
  btcPayStoreId: '',
  btcPayApiKey: '',
};

const configUpdateSchema = z.record(z.string(), z.any())
  .refine(
    (obj) => {
      for (const key of Object.keys(obj)) {
        if (!VALID_CONFIG_KEYS.has(key)) {
          return false;
        }
      }
      return true;
    },
    { message: 'Invalid config keys' }
  )
  .refine(
    (obj) => {
      const positiveFields = ['maxDailyPayout', 'maxPayoutPerUser', 'minWithdrawal', 'triviaPerHour', 'withdrawalsPerDay'];
      for (const key of positiveFields) {
        if (key in obj && typeof obj[key] === 'number' && obj[key] <= 0) {
          return false;
        }
      }
      return true;
    },
    { message: 'Invalid config values' }
  );

configRoute.get('/', requireAuth, async (c) => {
  const allConfig = await db.select().from(config);

  const result: Record<string, string> = {};

  for (const item of allConfig) {
    if (SENSITIVE_FIELDS.includes(item.key) && item.value) {
      result[item.key] = '***masked***';
    } else {
      result[item.key] = item.value;
    }
  }

  return c.json(result);
});

configRoute.post(
  '/',
  requireAuth,
  zValidator('json', configUpdateSchema),
  requireAdmin,
  async (c) => {
    const updates = c.req.valid('json');

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await db
        .select()
        .from(config)
        .where(eq(config.key, key))
        .get();

      if (existing) {
        await db
          .update(config)
          .set({ value: stringValue, updatedAt: new Date().toISOString() })
          .where(eq(config.key, key));
      } else {
        await db.insert(config).values({ key, value: stringValue });
      }
    }

    return c.json({ success: true });
  }
);

configRoute.delete('/', requireAuth, requireAdmin, async (c) => {
  await db.delete(config);

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await db.insert(config).values({ key, value });
  }

  return c.json({ success: true });
});
