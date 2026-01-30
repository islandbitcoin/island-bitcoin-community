import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { walletRoute } from './wallet';
import { db } from '../db';
import { users, balances, payouts, config } from '../db/schema';
import { verifyEvent } from '@island-bitcoin/nostr';
import { eq } from 'drizzle-orm';
import type { Event } from 'nostr-tools';
import * as flashService from '../services/flash';

vi.mock('@island-bitcoin/nostr', () => ({
  verifyEvent: vi.fn(() => true),
}));

vi.mock('../services/flash');

describe('GET /api/wallet/balance', () => {
  let app: Hono;
  const testPubkey = 'test_pubkey_123';

  beforeEach(async () => {
    await db.delete(balances);
    await db.delete(users);

    app = new Hono();
    app.route('/api/wallet', walletRoute);
  });

  function createAuthHeader(pubkey: string): string {
    const event: Event = {
      kind: 27235,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', 'http://localhost/api/wallet/balance'],
        ['method', 'GET'],
      ],
      content: '',
      sig: 'test_signature',
      id: 'test_id',
    };

    const eventJson = JSON.stringify(event);
    const base64Event = Buffer.from(eventJson).toString('base64');
    return `Nostr ${base64Event}`;
  }

  describe('authentication', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await app.request('http://localhost/api/wallet/balance');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid Authorization header', async () => {
      const res = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: 'Bearer invalid_token',
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('balance retrieval', () => {
    it('should return existing balance for authenticated user', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 1000,
        pending: 100,
        totalEarned: 5000,
        totalWithdrawn: 3900,
      });

      const res = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toEqual({
        pubkey: testPubkey,
        balance: 1000,
        pendingBalance: 100,
        totalEarned: 5000,
        totalWithdrawn: 3900,
        lastActivity: expect.any(String),
      });
    });

    it('should create new balance record if user does not exist', async () => {
      const res = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toEqual({
        pubkey: testPubkey,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        lastActivity: expect.any(String),
      });

      const createdBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, testPubkey),
      });

      expect(createdBalance).toBeDefined();
      expect(createdBalance?.balance).toBe(0);
      expect(createdBalance?.pending).toBe(0);
      expect(createdBalance?.totalEarned).toBe(0);
      expect(createdBalance?.totalWithdrawn).toBe(0);
    });

    it('should return correct UserBalance structure', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 500,
        pending: 50,
        totalEarned: 2000,
        totalWithdrawn: 1450,
      });

      const res = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('pubkey');
      expect(body).toHaveProperty('balance');
      expect(body).toHaveProperty('pendingBalance');
      expect(body).toHaveProperty('totalEarned');
      expect(body).toHaveProperty('totalWithdrawn');
      expect(body).toHaveProperty('lastActivity');

      expect(typeof body.pubkey).toBe('string');
      expect(typeof body.balance).toBe('number');
      expect(typeof body.pendingBalance).toBe('number');
      expect(typeof body.totalEarned).toBe('number');
      expect(typeof body.totalWithdrawn).toBe('number');
      expect(typeof body.lastActivity).toBe('string');
    });

    it('should return 200 for multiple requests from same user', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 1000,
        pending: 100,
        totalEarned: 5000,
        totalWithdrawn: 3900,
      });

      const res1 = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res1.status).toBe(200);

      const res2 = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res2.status).toBe(200);
      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1).toEqual(body2);
    });
  });

  describe('isolation', () => {
    it('should return different balances for different users', async () => {
      const pubkey1 = 'user1_pubkey';
      const pubkey2 = 'user2_pubkey';

      await db.insert(users).values([
        { pubkey: pubkey1 },
        { pubkey: pubkey2 },
      ]);

      await db.insert(balances).values([
        {
          userId: pubkey1,
          balance: 1000,
          pending: 100,
          totalEarned: 5000,
          totalWithdrawn: 3900,
        },
        {
          userId: pubkey2,
          balance: 2000,
          pending: 200,
          totalEarned: 10000,
          totalWithdrawn: 7800,
        },
      ]);

      const res1 = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(pubkey1),
        },
      });

      const res2 = await app.request('http://localhost/api/wallet/balance', {
        headers: {
          Authorization: createAuthHeader(pubkey2),
        },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1.pubkey).toBe(pubkey1);
      expect(body1.balance).toBe(1000);

      expect(body2.pubkey).toBe(pubkey2);
      expect(body2.balance).toBe(2000);
    });
  });
});

describe('POST /api/wallet/award', () => {
  let app: Hono;
  const adminPubkey = 'admin_pubkey_123';
  const userPubkey = 'user_pubkey_456';

  beforeEach(async () => {
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);
    await db.delete(config);

    app = new Hono();
    app.route('/api/wallet', walletRoute);

    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([adminPubkey]),
    });
  });

  function createAuthHeader(pubkey: string, method: string = 'POST', path: string = '/api/wallet/award'): string {
    const event: Event = {
      kind: 27235,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', `http://localhost${path}`],
        ['method', method],
      ],
      content: '',
      sig: 'test_signature',
      id: 'test_id',
    };

    const eventJson = JSON.stringify(event);
    const base64Event = Buffer.from(eventJson).toString('base64');
    return `Nostr ${base64Event}`;
  }

  describe('authentication and authorization', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 100, gameType: 'trivia' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 100, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('should return 400 for amount <= 0', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 0, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for negative amount', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: -100, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid gameType', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 100, gameType: 'invalid' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should accept valid gameTypes: trivia, stacker, achievement', async () => {
      for (const gameType of ['trivia', 'stacker', 'achievement']) {
        const res = await app.request('http://localhost/api/wallet/award', {
          method: 'POST',
          body: JSON.stringify({ userId: userPubkey, amount: 100, gameType }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: createAuthHeader(adminPubkey),
          },
        });

        expect(res.status).toBe(200);
      }
    });
  });

  describe('award functionality', () => {
    it('should award sats and update balance for existing user', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 3900,
      });

      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 500, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.pubkey).toBe(userPubkey);
      expect(body.balance).toBe(1500);
      expect(body.totalEarned).toBe(5500);
    });

    it('should create balance record if user does not exist', async () => {
      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 250, gameType: 'stacker' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.pubkey).toBe(userPubkey);
      expect(body.balance).toBe(250);
      expect(body.totalEarned).toBe(250);
    });

    it('should create payout record with status=paid', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 100, gameType: 'achievement' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(200);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });

      expect(payout).toBeDefined();
      expect(payout?.amount).toBe(100);
      expect(payout?.gameType).toBe('achievement');
      expect(payout?.status).toBe('paid');
      expect(payout?.userId).toBe(userPubkey);
    });

    it('should return updated UserBalance', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 500,
        pending: 50,
        totalEarned: 2000,
        totalWithdrawn: 1450,
      });

      const res = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 300, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('pubkey');
      expect(body).toHaveProperty('balance');
      expect(body).toHaveProperty('pendingBalance');
      expect(body).toHaveProperty('totalEarned');
      expect(body).toHaveProperty('totalWithdrawn');
      expect(body).toHaveProperty('lastActivity');

      expect(body.pubkey).toBe(userPubkey);
      expect(body.balance).toBe(800);
      expect(body.pendingBalance).toBe(50);
      expect(body.totalEarned).toBe(2300);
      expect(body.totalWithdrawn).toBe(1450);
    });

    it('should handle multiple awards to same user', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      const res1 = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 100, gameType: 'trivia' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      const res2 = await app.request('http://localhost/api/wallet/award', {
        method: 'POST',
        body: JSON.stringify({ userId: userPubkey, amount: 200, gameType: 'stacker' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(adminPubkey),
        },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1.balance).toBe(100);
      expect(body2.balance).toBe(300);
      expect(body2.totalEarned).toBe(300);

      const payoutCount = await db.query.payouts.findMany({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });

      expect(payoutCount).toHaveLength(2);
    });
  });
});

describe('POST /api/wallet/withdraw', () => {
  let app: Hono;
  const userPubkey = 'user_pubkey_789';
  const validLightningAddress = 'user@example.com';

  beforeEach(async () => {
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);
    await db.delete(config);

    app = new Hono();
    app.route('/api/wallet', walletRoute);

    await db.insert(config).values({
      key: 'withdrawal_min',
      value: '100',
    });
  });

  function createAuthHeader(pubkey: string, method: string = 'POST', path: string = '/api/wallet/withdraw'): string {
    const event: Event = {
      kind: 27235,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', `http://localhost${path}`],
        ['method', method],
      ],
      content: '',
      sig: 'test_signature',
      id: 'test_id',
    };

    const eventJson = JSON.stringify(event);
    const base64Event = Buffer.from(eventJson).toString('base64');
    return `Nostr ${base64Event}`;
  }

  describe('authentication', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('should return 400 for amount < minimum withdrawal', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 50, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid Lightning Address format', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: 'invalid-address' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should accept valid Lightning Address formats', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 5000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 0,
      });

      const validAddresses = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
      ];

      for (const address of validAddresses) {
        const res = await app.request('http://localhost/api/wallet/withdraw', {
          method: 'POST',
          body: JSON.stringify({ amount: 100, lightningAddress: address }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: createAuthHeader(userPubkey),
          },
        });

        expect(res.status).toBe(200);
      }
    });
  });

  describe('balance validation', () => {
    it('should return 400 if balance < amount', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 50,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4950,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should allow withdrawal with exact balance', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4900,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.balance).toBe(0);
      expect(body.pendingBalance).toBe(100);
    });

    it('should allow withdrawal with minimum amount', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4900,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('should allow up to 10 withdrawals per day', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 10000,
        pending: 0,
        totalEarned: 10000,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      for (let i = 0; i < 10; i++) {
        const res = await app.request('http://localhost/api/wallet/withdraw', {
          method: 'POST',
          body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: createAuthHeader(userPubkey),
          },
        });

        expect(res.status).toBe(200);
      }
    });

    it('should reject 11th withdrawal in same day (429)', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 20000,
        pending: 0,
        totalEarned: 20000,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      for (let i = 0; i < 10; i++) {
        await db.insert(payouts).values({
          id: `payout_${i}`,
          userId: userPubkey,
          amount: 100,
          gameType: 'withdrawal',
          status: 'pending',
          timestamp: today.toISOString(),
        });
      }

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(429);
    });

    it('should allow withdrawal after UTC day boundary', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 2000,
        pending: 0,
        totalEarned: 2000,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

      for (let i = 0; i < 10; i++) {
        await db.insert(payouts).values({
          id: `payout_${i}`,
          userId: userPubkey,
          amount: 100,
          gameType: 'withdrawal',
          status: 'pending',
          timestamp: yesterday.toISOString(),
        });
      }

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('withdrawal functionality', () => {
    it('should create pending payout record', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4000,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 500, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });

      expect(payout).toBeDefined();
      expect(payout?.amount).toBe(500);
      expect(payout?.gameType).toBe('withdrawal');
      expect(payout?.status).toBe('pending');
    });

    it('should update balance correctly', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4000,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 300, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.pubkey).toBe(userPubkey);
      expect(body.balance).toBe(700);
      expect(body.pendingBalance).toBe(300);
      expect(body.totalWithdrawn).toBe(4300);
    });

    it('should return updated UserBalance', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 500,
        pending: 50,
        totalEarned: 2000,
        totalWithdrawn: 1450,
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 200, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('pubkey');
      expect(body).toHaveProperty('balance');
      expect(body).toHaveProperty('pendingBalance');
      expect(body).toHaveProperty('totalEarned');
      expect(body).toHaveProperty('totalWithdrawn');
      expect(body).toHaveProperty('lastActivity');

      expect(body.pubkey).toBe(userPubkey);
      expect(body.balance).toBe(300);
      expect(body.pendingBalance).toBe(250);
      expect(body.totalEarned).toBe(2000);
      expect(body.totalWithdrawn).toBe(1650);
    });

    it('should handle multiple withdrawals from same user', async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 1000,
        pending: 0,
        totalEarned: 5000,
        totalWithdrawn: 4000,
      });

      const res1 = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      const res2 = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 200, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1.balance).toBe(900);
      expect(body1.pendingBalance).toBe(100);

      expect(body2.balance).toBe(700);
      expect(body2.pendingBalance).toBe(300);

      const payoutCount = await db.query.payouts.findMany({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });

      expect(payoutCount).toHaveLength(2);
    });
  });

  describe('auto-process via Flash', () => {
    beforeEach(async () => {
      await db.insert(users).values({ pubkey: userPubkey });
      await db.insert(balances).values({
        userId: userPubkey,
        balance: 5000,
        pending: 0,
        totalEarned: 10000,
        totalWithdrawn: 5000,
      });

      await db.insert(config).values({
        key: 'ory_token',
        value: 'flash-test-token',
      });

      vi.clearAllMocks();
    });

    it('should auto-process small withdrawal and set status to paid', async () => {
      vi.mocked(flashService.sendPayment).mockResolvedValue({
        success: true,
        paymentHash: 'hash-abc',
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 500, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.balance).toBe(4500);
      expect(body.pendingBalance).toBe(0);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });
      expect(payout?.status).toBe('paid');
      expect(payout?.txId).toBe('hash-abc');

      expect(flashService.sendPayment).toHaveBeenCalledWith(
        validLightningAddress, 500, 'flash-test-token'
      );
    });

    it('should leave payout as pending when Flash payment fails', async () => {
      vi.mocked(flashService.sendPayment).mockResolvedValue({
        success: false,
        error: 'Route not found',
      });

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 500, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pendingBalance).toBe(500);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });
      expect(payout?.status).toBe('pending');
    });

    it('should leave payout as pending when sendPayment throws', async () => {
      vi.mocked(flashService.sendPayment).mockRejectedValue(new Error('Network error'));

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 500, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });
      expect(payout?.status).toBe('pending');
    });

    it('should not auto-process withdrawal >= 1000 sats', async () => {
      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 1000, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pendingBalance).toBe(1000);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });
      expect(payout?.status).toBe('pending');
      expect(flashService.sendPayment).not.toHaveBeenCalled();
    });

    it('should save lightning address to user record', async () => {
      vi.mocked(flashService.sendPayment).mockResolvedValue({ success: true, paymentHash: 'h' });

      await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 200, lightningAddress: 'new@address.com' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.pubkey, userPubkey),
      });
      expect(user?.lightningAddress).toBe('new@address.com');
    });

    it('should leave payout as pending when ory_token not configured', async () => {
      await db.delete(config).where(eq(config.key, 'ory_token'));

      const res = await app.request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: 500, lightningAddress: validLightningAddress }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pendingBalance).toBe(500);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, userPubkey),
      });
      expect(payout?.status).toBe('pending');
      expect(flashService.sendPayment).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/wallet/payouts', () => {
  let app: Hono;
  const userPubkey = 'user_pubkey_payouts';
  const otherUserPubkey = 'other_user_pubkey';

  beforeEach(async () => {
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);

    app = new Hono();
    app.route('/api/wallet', walletRoute);

    await db.insert(users).values([
      { pubkey: userPubkey },
      { pubkey: otherUserPubkey },
    ]);
  });

  function createAuthHeader(pubkey: string, method: string = 'GET', path: string = '/api/wallet/payouts'): string {
    const event: Event = {
      kind: 27235,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', `http://localhost${path}`],
        ['method', method],
      ],
      content: '',
      sig: 'test_signature',
      id: 'test_id',
    };

    const eventJson = JSON.stringify(event);
    const base64Event = Buffer.from(eventJson).toString('base64');
    return `Nostr ${base64Event}`;
  }

  describe('authentication', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts');

      expect(res.status).toBe(401);
    });
  });

  describe('basic functionality', () => {
    it('should return empty array when no payouts', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts', {
        headers: {
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts).toEqual([]);
      expect(body.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 0,
      });
    });

    it('should return payouts ordered by timestamp DESC', async () => {
      const now = new Date();
      const timestamps = [
        new Date(now.getTime() - 3000).toISOString(),
        new Date(now.getTime() - 2000).toISOString(),
        new Date(now.getTime() - 1000).toISOString(),
      ];

      await db.insert(payouts).values([
        {
          id: 'payout_1',
          userId: userPubkey,
          amount: 100,
          gameType: 'trivia',
          status: 'paid',
          timestamp: timestamps[0],
        },
        {
          id: 'payout_2',
          userId: userPubkey,
          amount: 200,
          gameType: 'stacker',
          status: 'paid',
          timestamp: timestamps[1],
        },
        {
          id: 'payout_3',
          userId: userPubkey,
          amount: 300,
          gameType: 'achievement',
          status: 'paid',
          timestamp: timestamps[2],
        },
      ]);

      const res = await app.request('http://localhost/api/wallet/payouts', {
        headers: {
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts).toHaveLength(3);
      expect(body.payouts[0].id).toBe('payout_3');
      expect(body.payouts[1].id).toBe('payout_2');
      expect(body.payouts[2].id).toBe('payout_1');
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      const now = new Date();
      const payoutData = [];

      for (let i = 0; i < 75; i++) {
        payoutData.push({
          id: `payout_${i}`,
          userId: userPubkey,
          amount: 100 + i,
          gameType: 'trivia' as const,
          status: 'paid' as const,
          timestamp: new Date(now.getTime() - i * 1000).toISOString(),
        });
      }

      await db.insert(payouts).values(payoutData);
    });

    it('should default to limit=50', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts', {
        headers: {
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts).toHaveLength(50);
      expect(body.pagination.limit).toBe(50);
      expect(body.pagination.offset).toBe(0);
      expect(body.pagination.total).toBe(75);
    });

    it('should respect limit parameter', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts?limit=10', {
        headers: {
          Authorization: createAuthHeader(userPubkey, 'GET', '/api/wallet/payouts?limit=10'),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts).toHaveLength(10);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(75);
    });

    it('should enforce max limit=100', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts?limit=200', {
        headers: {
          Authorization: createAuthHeader(userPubkey, 'GET', '/api/wallet/payouts?limit=200'),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts.length).toBeLessThanOrEqual(100);
      expect(body.pagination.limit).toBe(100);
    });

    it('should respect offset parameter', async () => {
      const res1 = await app.request('http://localhost/api/wallet/payouts?limit=10&offset=0', {
        headers: {
          Authorization: createAuthHeader(userPubkey, 'GET', '/api/wallet/payouts?limit=10&offset=0'),
        },
      });

      const res2 = await app.request('http://localhost/api/wallet/payouts?limit=10&offset=10', {
        headers: {
          Authorization: createAuthHeader(userPubkey, 'GET', '/api/wallet/payouts?limit=10&offset=10'),
        },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1.payouts[0].id).not.toBe(body2.payouts[0].id);
      expect(body1.pagination.offset).toBe(0);
      expect(body2.pagination.offset).toBe(10);
    });

    it('should return correct total count', async () => {
      const res = await app.request('http://localhost/api/wallet/payouts?limit=10&offset=0', {
        headers: {
          Authorization: createAuthHeader(userPubkey, 'GET', '/api/wallet/payouts?limit=10&offset=0'),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.pagination.total).toBe(75);
    });
  });

  describe('isolation', () => {
    it('should return only user\'s own payouts', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        {
          id: 'user_payout_1',
          userId: userPubkey,
          amount: 100,
          gameType: 'trivia',
          status: 'paid',
          timestamp: now.toISOString(),
        },
        {
          id: 'user_payout_2',
          userId: userPubkey,
          amount: 200,
          gameType: 'stacker',
          status: 'paid',
          timestamp: new Date(now.getTime() - 1000).toISOString(),
        },
        {
          id: 'other_payout_1',
          userId: otherUserPubkey,
          amount: 500,
          gameType: 'achievement',
          status: 'paid',
          timestamp: new Date(now.getTime() - 2000).toISOString(),
        },
      ]);

      const res = await app.request('http://localhost/api/wallet/payouts', {
        headers: {
          Authorization: createAuthHeader(userPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.payouts).toHaveLength(2);
      expect(body.payouts.every((p: any) => p.userPubkey === userPubkey)).toBe(true);
      expect(body.pagination.total).toBe(2);
    });
  });
});
