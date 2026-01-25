import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { configRoute } from './config';
import { db } from '../db';
import { config } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools';

describe('Config API Endpoints', () => {
  let app: Hono;

  beforeEach(async () => {
    // Delete all config EXCEPT admin_pubkeys (needed by auth tests)
    await db.delete(config).where(sql`${config.key} != 'admin_pubkeys'`);

    app = new Hono();
    app.route('/api/config', configRoute);
  });

  afterEach(async () => {
    await db.delete(config).where(sql`${config.key} != 'admin_pubkeys'`);
  });

  describe('GET /api/config', () => {
    it('should require authentication', async () => {
      const res = await app.request('http://localhost/api/config');
      expect(res.status).toBe(401);
    });

    it('should return full config with masked sensitive fields', async () => {
      // Set up config in database
      await db.insert(config).values([
        { key: 'maxDailyPayout', value: '1000' },
        { key: 'minWithdrawal', value: '100' },
        { key: 'btcPayApiKey', value: 'secret-key-12345' },
      ]);

      // Create valid NIP-98 auth header
      const authHeader = createValidAuthHeader('GET', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('maxDailyPayout', '1000');
      expect(body).toHaveProperty('minWithdrawal', '100');
      // Sensitive field should be masked
      expect(body).toHaveProperty('btcPayApiKey', '***masked***');
    });

    it('should mask ory_token if present', async () => {
      await db.insert(config).values([
        { key: 'ory_token', value: 'actual-token-value' },
      ]);

      const authHeader = createValidAuthHeader('GET', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('ory_token', '***masked***');
    });

    it('should return empty object when no config exists', async () => {
      const authHeader = createValidAuthHeader('GET', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(Object.keys(body).length).toBe(0);
    });

    it('should not mask non-sensitive fields', async () => {
      await db.insert(config).values([
        { key: 'maxDailyPayout', value: '1000' },
        { key: 'adminPubkeys', value: '["pubkey1","pubkey2"]' },
      ]);

      const authHeader = createValidAuthHeader('GET', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.maxDailyPayout).toBe('1000');
      expect(body.adminPubkeys).toBe('["pubkey1","pubkey2"]');
    });
  });

  describe('POST /api/config', () => {
    it('should require admin privileges', async () => {
      const authHeader = createValidAuthHeader('POST', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDailyPayout: '2000' }),
      });

      // Should fail because user is not admin (no admin_pubkeys in config)
      expect(res.status).toBe(403);
    });

    it('should update config when admin', async () => {
      await db.insert(config).values([
        { key: 'admin_pubkeys', value: JSON.stringify([TEST_PUBKEY]) },
      ]);

      await new Promise(resolve => setTimeout(resolve, 50));

      const authHeader = createValidAuthHeader('POST', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDailyPayout: '2000' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });

      // Verify config was updated in database
      const updated = await db
        .select()
        .from(config)
        .where(eq(config.key, 'maxDailyPayout'))
        .get();

      expect(updated?.value).toBe('2000');
    });

    it('should merge with existing config (partial update)', async () => {
      await db.insert(config).values([
        { key: 'admin_pubkeys', value: JSON.stringify([TEST_PUBKEY]) },
        { key: 'maxDailyPayout', value: '1000' },
        { key: 'minWithdrawal', value: '100' },
      ]);

      await new Promise(resolve => setTimeout(resolve, 50));

      const authHeader = createValidAuthHeader('POST', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDailyPayout: '2000' }),
      });

      expect(res.status).toBe(200);

      // Verify only maxDailyPayout was updated, minWithdrawal unchanged
      const maxDaily = await db
        .select()
        .from(config)
        .where(eq(config.key, 'maxDailyPayout'))
        .get();
      const minWithdraw = await db
        .select()
        .from(config)
        .where(eq(config.key, 'minWithdrawal'))
        .get();

      expect(maxDaily?.value).toBe('2000');
      expect(minWithdraw?.value).toBe('100');
    });

    it('should validate input against GameWalletConfigSchema', async () => {
      await db.insert(config).values([
        { key: 'admin_pubkeys', value: JSON.stringify([TEST_PUBKEY]) },
      ]);

      const authHeader = createValidAuthHeader('POST', 'http://localhost/api/config');

      // Send invalid config (negative number for positive field)
      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDailyPayout: -100 }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject unknown config keys', async () => {
      await db.insert(config).values([
        { key: 'admin_pubkeys', value: JSON.stringify([TEST_PUBKEY]) },
      ]);

      const authHeader = createValidAuthHeader('POST', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unknownKey: 'value' }),
      });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await app.request('http://localhost/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDailyPayout: '2000' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/config', () => {
    it('should require admin privileges', async () => {
      const authHeader = createValidAuthHeader('DELETE', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(403);
    });

    it('should reset config to defaults when admin', async () => {
      await db.insert(config).values([
        { key: 'admin_pubkeys', value: JSON.stringify([TEST_PUBKEY]) },
        { key: 'maxDailyPayout', value: '2000' },
        { key: 'minWithdrawal', value: '500' },
      ]);

      const authHeader = createValidAuthHeader('DELETE', 'http://localhost/api/config');

      const res = await app.request('http://localhost/api/config', {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });

      // Verify config was reset to defaults
      const allConfig = await db.select().from(config);
      expect(allConfig.length).toBeGreaterThan(0);

      // Check that values match defaults
      const maxDaily = allConfig.find((c) => c.key === 'maxDailyPayout');
      expect(maxDaily?.value).toBe('10000'); // Default value
    });

    it('should require authentication', async () => {
      const res = await app.request('http://localhost/api/config', {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
    });
  });
});

const TEST_SECRET_KEY = generateSecretKey();
const TEST_PUBKEY = getPublicKey(TEST_SECRET_KEY);

function createNIP98Event(url: string, method: string, secretKey: Uint8Array = TEST_SECRET_KEY) {
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
  };

  return finalizeEvent(event, secretKey);
}

function encodeAuthHeader(event: any): string {
  const base64Event = Buffer.from(JSON.stringify(event)).toString('base64');
  return `Nostr ${base64Event}`;
}

function createValidAuthHeader(method: string, url: string, secretKey: Uint8Array = TEST_SECRET_KEY): string {
  const event = createNIP98Event(url, method, secretKey);
  return encodeAuthHeader(event);
}
