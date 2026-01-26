import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { payouts, config } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { sendPayment } from '../../services/flash';

export const payoutsRoute = new Hono();

const processPayoutsSchema = z.object({
  autoApprove: z.boolean().optional().default(false),
  threshold: z.number().int().positive().optional().default(100),
});

payoutsRoute.post(
  '/process',
  requireAuth,
  requireAdmin,
  zValidator('json', processPayoutsSchema),
  async (c) => {
    const { autoApprove, threshold } = c.req.valid('json');

    const oryTokenConfig = await db.query.config.findFirst({
      where: (config, { eq }) => eq(config.key, 'ory_token'),
    });

    if (!oryTokenConfig?.value) {
      return c.json({ error: 'Flash API token not configured' }, 400);
    }

    const pendingPayouts = await db.query.payouts.findMany({
      where: (payouts, { eq }) => eq(payouts.status, 'pending'),
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const payout of pendingPayouts) {
      if (autoApprove && payout.amount > threshold) {
        continue;
      }

      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.pubkey, payout.userId),
      });

      if (!user?.lightningAddress) {
        await db
          .update(payouts)
          .set({ status: 'failed' })
          .where(eq(payouts.id, payout.id));
        failed++;
        processed++;
        continue;
      }

      const result = await sendPayment(
        user.lightningAddress,
        payout.amount,
        oryTokenConfig.value
      );

      if (result.success) {
        await db
          .update(payouts)
          .set({
            status: 'paid',
            txId: result.paymentHash,
          })
          .where(eq(payouts.id, payout.id));
        succeeded++;
      } else {
        await db
          .update(payouts)
          .set({ status: 'failed' })
          .where(eq(payouts.id, payout.id));
        failed++;
      }

      processed++;
    }

    return c.json({
      processed,
      succeeded,
      failed,
    });
  }
);
