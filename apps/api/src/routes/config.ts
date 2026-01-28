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
  'whitelistedDomains',
  'communityPubkeys',
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
  whitelistedDomains: '[]',
  communityPubkeys: '[]',
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

// Public endpoint for whitelisted domains and community pubkeys (no auth required)
configRoute.get('/public', async (c) => {
  const [domainsRow, pubkeysRow] = await Promise.all([
    db.select().from(config).where(eq(config.key, 'whitelistedDomains')).get(),
    db.select().from(config).where(eq(config.key, 'communityPubkeys')).get(),
  ]);

  let domains: string[] = [];
  let pubkeys: string[] = [];
  
  if (domainsRow?.value) {
    try { domains = JSON.parse(domainsRow.value); } catch { domains = []; }
  }
  if (pubkeysRow?.value) {
    try { pubkeys = JSON.parse(pubkeysRow.value); } catch { pubkeys = []; }
  }

  return c.json({ whitelistedDomains: domains, communityPubkeys: pubkeys });
});

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

configRoute.post('/discover-pubkeys', requireAuth, requireAdmin, async (c) => {
  try {
    // Get whitelisted domains from DB
    const domainsRow = await db
      .select()
      .from(config)
      .where(eq(config.key, 'whitelistedDomains'))
      .get();

    let domains: string[] = [];
    if (domainsRow?.value) {
      try {
        domains = JSON.parse(domainsRow.value);
      } catch {
        domains = [];
      }
    }

    // Get existing community pubkeys
    const pubkeysRow = await db
      .select()
      .from(config)
      .where(eq(config.key, 'communityPubkeys'))
      .get();

    let existingPubkeys: string[] = [];
    if (pubkeysRow?.value) {
      try {
        existingPubkeys = JSON.parse(pubkeysRow.value);
      } catch {
        existingPubkeys = [];
      }
    }

    const discoveredPubkeys = new Set(existingPubkeys);
    const domainResults: Record<string, { found: number; pubkeys: string[] } | { error: string }> = {};

    // Fetch NIP-05 data from each domain
    for (const domain of domains) {
      try {
        let response: Response | null = null;
        let data: any = null;

        // Try without query param first
        try {
          response = await Promise.race([
            fetch(`https://${domain}/.well-known/nostr.json`),
            new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            ),
          ]);

          if (response.ok) {
            data = await response.json();
          }
        } catch {
          // First attempt threw (timeout, network error, etc.)
        }

        // If first attempt failed or returned no names, try with ?name=_ query param
        if (!data || !data.names) {
          try {
            response = await Promise.race([
              fetch(`https://${domain}/.well-known/nostr.json?name=_`),
              new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 5000)
              ),
            ]);

            if (response.ok) {
              data = await response.json();
            }
          } catch {
            // Both attempts failed
          }
        }

        if (!data && !response?.ok) {
          domainResults[domain] = { error: 'Failed to fetch NIP-05 data' };
          continue;
        }

        // Extract pubkeys from names object
        if (data && typeof data === 'object' && data.names && typeof data.names === 'object') {
          const pubkeys: string[] = [];
          for (const pubkey of Object.values(data.names)) {
            if (typeof pubkey === 'string' && pubkey.length === 64) {
              pubkeys.push(pubkey);
              discoveredPubkeys.add(pubkey);
            }
          }
          domainResults[domain] = { found: pubkeys.length, pubkeys };
        } else {
          domainResults[domain] = { found: 0, pubkeys: [] };
        }
      } catch (error) {
        domainResults[domain] = {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Save merged pubkeys back to DB
    const mergedPubkeys = Array.from(discoveredPubkeys);
    const stringValue = JSON.stringify(mergedPubkeys);

    const existing = await db
      .select()
      .from(config)
      .where(eq(config.key, 'communityPubkeys'))
      .get();

    if (existing) {
      await db
        .update(config)
        .set({ value: stringValue, updatedAt: new Date().toISOString() })
        .where(eq(config.key, 'communityPubkeys'));
    } else {
      await db.insert(config).values({ key: 'communityPubkeys', value: stringValue });
    }

    const totalDiscovered = mergedPubkeys.length - existingPubkeys.length;

    return c.json({
      success: true,
      discovered: totalDiscovered,
      total: mergedPubkeys.length,
      domains: domainResults,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

configRoute.delete('/', requireAuth, requireAdmin, async (c) => {
  await db.delete(config);

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await db.insert(config).values({ key, value });
  }

  return c.json({ success: true });
});
