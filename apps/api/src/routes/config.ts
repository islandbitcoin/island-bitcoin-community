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
  'pullPaymentId',
  'btcPayServerUrl',
  'btcPayStoreId',
  'btcPayApiKey',
  'whitelistedDomains',
  'communityPubkeys',
  'ory_token',
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

    // Search NIP-50 relay for kind 0 profiles matching each domain
    const { WebSocket } = await import('ws');
    const SEARCH_RELAYS = ['wss://search.nos.today', 'wss://relay.nostr.band'];

    for (const domain of domains) {
      const domainPubkeys: string[] = [];

      const searchRelay = (relayUrl: string): Promise<void> => {
        return new Promise((resolve) => {
          const ws = new WebSocket(relayUrl);
          const timeout = setTimeout(() => { ws.close(); resolve(); }, 10000);

          ws.on('open', () => {
            ws.send(JSON.stringify(['REQ', 'discover', { kinds: [0], search: domain, limit: 200 }]));
          });

          ws.on('message', (data: Buffer) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg[0] === 'EVENT' && msg[2]) {
                const content = JSON.parse(msg[2].content || '{}');
                const nip05 = (content.nip05 || '').toLowerCase();
                if (nip05.endsWith(`@${domain}`)) {
                  const pubkey = msg[2].pubkey;
                  if (typeof pubkey === 'string' && pubkey.length === 64 && !discoveredPubkeys.has(pubkey)) {
                    domainPubkeys.push(pubkey);
                    discoveredPubkeys.add(pubkey);
                  }
                }
              }
              if (msg[0] === 'EOSE') {
                clearTimeout(timeout);
                ws.close();
                resolve();
              }
            } catch {}
          });

          ws.on('error', () => { clearTimeout(timeout); resolve(); });
          ws.on('close', () => { clearTimeout(timeout); resolve(); });
        });
      };

      for (const relayUrl of SEARCH_RELAYS) {
        try {
          await searchRelay(relayUrl);
          if (domainPubkeys.length > 0) break;
        } catch {
          continue;
        }
      }

      domainResults[domain] = { found: domainPubkeys.length, pubkeys: domainPubkeys };
    }

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
