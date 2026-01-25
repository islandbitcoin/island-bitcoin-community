import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { stackerRoute } from './stacker';
import { db } from '../db';
import { users, balances, payouts, config } from '../db/schema';
import { verifyEvent } from '@island-bitcoin/nostr';
import type { Event } from 'nostr-tools';

vi.mock('@island-bitcoin/nostr', () => ({
  verifyEvent: vi.fn(() => true),
}));

describe('Stacker Route', () => {
  let app: Hono;
  const testPubkey = 'test_pubkey_stacker_123';

  beforeEach(async () => {
    await db.delete(balances);
    await db.delete(users);
    await db.delete(payouts);
    await db.delete(config);

    app = new Hono();
    app.route('/api/stacker', stackerRoute);
  });

  function createAuthHeader(pubkey: string, method: string = 'POST', path: string = '/api/stacker/claim'): string {
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

  describe('POST /api/stacker/claim', () => {
    it('should require authentication', async () => {
      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });

    it('should award sats on successful claim', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('satsEarned');
      expect(data).toHaveProperty('claimsRemaining');
      expect(data.satsEarned).toBe(5);
      expect(data.claimsRemaining).toBe(9);

      const updatedBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, testPubkey),
      });

      expect(updatedBalance?.balance).toBe(105);
      expect(updatedBalance?.totalEarned).toBe(105);
    });

    it('should create user and balance if they do not exist', async () => {
      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.satsEarned).toBe(5);

      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.pubkey, testPubkey),
      });

      expect(user).toBeDefined();

      const balance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, testPubkey),
      });

      expect(balance?.balance).toBe(5);
    });

    it('should respect stackerDailyLimit from config', async () => {
      await db.insert(config).values({
        key: 'stackerDailyLimit',
        value: '3',
        updatedAt: new Date().toISOString(),
      });

      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      await db.insert(payouts).values([
        {
          id: '1',
          userId: testPubkey,
          amount: 5,
          gameType: 'stacker',
          status: 'paid',
          timestamp: startOfDay.toISOString(),
        },
        {
          id: '2',
          userId: testPubkey,
          amount: 5,
          gameType: 'stacker',
          status: 'paid',
          timestamp: startOfDay.toISOString(),
        },
        {
          id: '3',
          userId: testPubkey,
          amount: 5,
          gameType: 'stacker',
          status: 'paid',
          timestamp: startOfDay.toISOString(),
        },
      ]);

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(429);
    });

    it('should use default stackerReward of 5 sats when not configured', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.satsEarned).toBe(5);
    });

    it('should use configured stackerReward', async () => {
      await db.insert(config).values({
        key: 'stackerReward',
        value: '25',
        updatedAt: new Date().toISOString(),
      });

      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.satsEarned).toBe(25);

      const updatedBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, testPubkey),
      });

      expect(updatedBalance?.balance).toBe(125);
    });

    it('should use default stackerDailyLimit of 10 when not configured', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      const existingPayouts = Array.from({ length: 9 }, (_, i) => ({
        id: `${i}`,
        userId: testPubkey,
        amount: 5,
        gameType: 'stacker' as const,
        status: 'paid' as const,
        timestamp: startOfDay.toISOString(),
      }));

      await db.insert(payouts).values(existingPayouts);

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.claimsRemaining).toBe(0);
    });

    it('should return claimsRemaining in response', async () => {
      await db.insert(config).values({
        key: 'stackerDailyLimit',
        value: '10',
        updatedAt: new Date().toISOString(),
      });

      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      const existingPayouts = Array.from({ length: 2 }, (_, i) => ({
        id: `${i}`,
        userId: testPubkey,
        amount: 5,
        gameType: 'stacker' as const,
        status: 'paid' as const,
        timestamp: startOfDay.toISOString(),
      }));

      await db.insert(payouts).values(existingPayouts);

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.claimsRemaining).toBe(7);
    });

    it('should rate limit at daily limit', async () => {
      await db.insert(config).values({
        key: 'stackerDailyLimit',
        value: '5',
        updatedAt: new Date().toISOString(),
      });

      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      const existingPayouts = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        userId: testPubkey,
        amount: 5,
        gameType: 'stacker' as const,
        status: 'paid' as const,
        timestamp: startOfDay.toISOString(),
      }));

      await db.insert(payouts).values(existingPayouts);

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(429);
    });

    it('should only count stacker payouts for rate limiting', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      await db.insert(payouts).values([
        {
          id: '1',
          userId: testPubkey,
          amount: 100,
          gameType: 'trivia',
          status: 'paid',
          timestamp: startOfDay.toISOString(),
        },
        {
          id: '2',
          userId: testPubkey,
          amount: 50,
          gameType: 'withdrawal',
          status: 'pending',
          timestamp: startOfDay.toISOString(),
        },
      ]);

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.claimsRemaining).toBe(9);
    });

    it('should only count claims from today (UTC)', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      await db.insert(payouts).values({
        id: '1',
        userId: testPubkey,
        amount: 5,
        gameType: 'stacker',
        status: 'paid',
        timestamp: yesterday.toISOString(),
      });

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.claimsRemaining).toBe(9);
    });

    it('should create payout record with correct gameType', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/stacker/claim', {
        method: 'POST',
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.userId, testPubkey),
      });

      expect(payout).toBeDefined();
      expect(payout?.gameType).toBe('stacker');
      expect(payout?.status).toBe('paid');
      expect(payout?.amount).toBe(5);
    });
  });
});
