import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { achievementsRoute } from './achievements';
import { db } from '../db';
import { users, balances, payouts, achievements, referrals, achievementDefinitions } from '../db/schema';
import { verifyEvent } from '@island-bitcoin/nostr';
import type { Event } from 'nostr-tools';

vi.mock('@island-bitcoin/nostr', () => ({
  verifyEvent: vi.fn(() => true),
}));

describe('GET /api/achievements', () => {
  let app: Hono;
  const testPubkey = 'test_pubkey_achievements';

  beforeEach(async () => {
    await db.delete(achievements);
    await db.delete(users);

    app = new Hono();
    app.route('/api/achievements', achievementsRoute);
  });

  function createAuthHeader(pubkey: string, method: string = 'GET', path: string = '/api/achievements'): string {
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
      const res = await app.request('http://localhost/api/achievements');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid Authorization header', async () => {
      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: 'Bearer invalid_token',
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('achievements retrieval', () => {
    it('should return empty array when user has no achievements', async () => {
      await db.insert(users).values({ pubkey: testPubkey });

      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toEqual([]);
    });

    it('should return user achievements with correct structure', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      
      const now = new Date().toISOString();
      await db.insert(achievements).values([
        {
          userId: testPubkey,
          achievementType: 'first_game',
          unlockedAt: now,
        },
        {
          userId: testPubkey,
          achievementType: 'streak_5',
          unlockedAt: now,
        },
      ]);

      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveLength(2);
      expect(body[0]).toHaveProperty('type');
      expect(body[0]).toHaveProperty('unlockedAt');
      expect(typeof body[0].type).toBe('string');
      expect(typeof body[0].unlockedAt).toBe('string');
    });

    it('should return all achievement types', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      
      const achievementTypes = [
        'first_game',
        'first_withdrawal',
        'streak_5',
        'streak_10',
        'level_10',
        'level_21',
        'total_earned_100',
        'total_earned_1000',
        'total_earned_10000',
        'games_played_10',
        'games_played_100',
        'referral_bonus',
      ];

      const now = new Date().toISOString();
      await db.insert(achievements).values(
        achievementTypes.map((type) => ({
          userId: testPubkey,
          achievementType: type,
          unlockedAt: now,
        }))
      );

      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveLength(achievementTypes.length);
      const returnedTypes = body.map((a: any) => a.type);
      achievementTypes.forEach((type) => {
        expect(returnedTypes).toContain(type);
      });
    });

    it('should return achievements ordered by unlockedAt DESC', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      
      const now = new Date();
      const timestamps = [
        new Date(now.getTime() - 3000).toISOString(),
        new Date(now.getTime() - 2000).toISOString(),
        new Date(now.getTime() - 1000).toISOString(),
      ];

      await db.insert(achievements).values([
        {
          userId: testPubkey,
          achievementType: 'first_game',
          unlockedAt: timestamps[0],
        },
        {
          userId: testPubkey,
          achievementType: 'streak_5',
          unlockedAt: timestamps[1],
        },
        {
          userId: testPubkey,
          achievementType: 'level_10',
          unlockedAt: timestamps[2],
        },
      ]);

      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveLength(3);
      expect(body[0].type).toBe('level_10');
      expect(body[1].type).toBe('streak_5');
      expect(body[2].type).toBe('first_game');
    });
  });

  describe('isolation', () => {
    it('should return only user\'s own achievements', async () => {
      const pubkey1 = 'user1_pubkey';
      const pubkey2 = 'user2_pubkey';

      await db.insert(users).values([
        { pubkey: pubkey1 },
        { pubkey: pubkey2 },
      ]);

      const now = new Date().toISOString();
      await db.insert(achievements).values([
        {
          userId: pubkey1,
          achievementType: 'first_game',
          unlockedAt: now,
        },
        {
          userId: pubkey1,
          achievementType: 'streak_5',
          unlockedAt: now,
        },
        {
          userId: pubkey2,
          achievementType: 'level_10',
          unlockedAt: now,
        },
      ]);

      const res = await app.request('http://localhost/api/achievements', {
        headers: {
          Authorization: createAuthHeader(pubkey1),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveLength(2);
      expect(body.every((a: any) => ['first_game', 'streak_5'].includes(a.type))).toBe(true);
    });
  });
});

describe('POST /api/referral/check', () => {
  let app: Hono;
  const referrerPubkey = 'referrer_pubkey_123';
  const refereePubkey = 'referee_pubkey_456';

  beforeEach(async () => {
    await db.delete(referrals);
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);

    app = new Hono();
    app.route('/api/achievements', achievementsRoute);

    await db.insert(users).values([
      { pubkey: referrerPubkey },
      { pubkey: refereePubkey },
    ]);
  });

  function createAuthHeader(pubkey: string, method: string = 'POST', path: string = '/api/achievements/referral/check'): string {
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
      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('completion criteria', () => {
    it('should return false when referee has no payouts', async () => {
      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(false);
    });

    it('should award bonus when referee has one trivia payout', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.insert(balances).values({
        userId: referrerPubkey,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(true);
      expect(body.amount).toBe(100);
    });

    it('should not award bonus for stacker-only payouts', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'stacker',
        status: 'paid',
        timestamp: now,
      });

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(false);
    });

    it('should not count non-game payouts', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values([
        { id: 'payout_1', userId: refereePubkey, amount: 10, gameType: 'referral', status: 'paid', timestamp: now },
        { id: 'payout_2', userId: refereePubkey, amount: 10, gameType: 'achievement', status: 'paid', timestamp: now },
      ]);

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(false);
    });

    it('should not count pending payouts', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'pending',
        timestamp: now,
      });

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(false);
    });
  });

  describe('bonus payment', () => {
    it('should create payout record with gameType referral', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.insert(balances).values({
        userId: referrerPubkey,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq, and }) =>
          and(
            eq(payouts.userId, referrerPubkey),
            eq(payouts.gameType, 'referral')
          ),
      });

      expect(payout).toBeDefined();
      expect(payout?.amount).toBe(100);
      expect(payout?.status).toBe('paid');
    });

    it('should update referrer balance', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.insert(balances).values({
        userId: referrerPubkey,
        balance: 50,
        pending: 0,
        totalEarned: 50,
        totalWithdrawn: 0,
      });

      await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      const referrerBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, referrerPubkey),
      });

      expect(referrerBalance?.balance).toBe(150);
      expect(referrerBalance?.totalEarned).toBe(150);
    });

    it('should create referrer balance if not exists', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(true);
      expect(body.amount).toBe(100);

      const referrerBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, referrerPubkey),
      });

      expect(referrerBalance).toBeDefined();
      expect(referrerBalance?.balance).toBe(100);
      expect(referrerBalance?.totalEarned).toBe(100);
    });
  });

  describe('idempotency', () => {
    it('should not pay bonus twice', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.insert(referrals).values({
        referrerId: referrerPubkey,
        refereeId: refereePubkey,
        completed: true,
        bonusPaid: true,
      });

      await db.insert(balances).values({
        userId: referrerPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bonusPaid).toBe(false);

      const referrerBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, referrerPubkey),
      });

      expect(referrerBalance?.balance).toBe(100);
      expect(referrerBalance?.totalEarned).toBe(100);
    });

    it('should handle multiple requests without duplicate payment', async () => {
      const now = new Date().toISOString();
      await db.insert(payouts).values({
        id: 'payout_1',
        userId: refereePubkey,
        amount: 10,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.insert(balances).values({
        userId: referrerPubkey,
        balance: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      const res1 = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.bonusPaid).toBe(true);

      const res2 = await app.request('http://localhost/api/achievements/referral/check', {
        method: 'POST',
        body: JSON.stringify({ referrerId: referrerPubkey }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(refereePubkey),
        },
      });

      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.bonusPaid).toBe(false);

      const payoutCount = await db.query.payouts.findMany({
        where: (payouts, { eq, and }) =>
          and(
            eq(payouts.userId, referrerPubkey),
            eq(payouts.gameType, 'referral')
          ),
      });

      expect(payoutCount).toHaveLength(1);

      const referrerBalance = await db.query.balances.findFirst({
        where: (balances, { eq }) => eq(balances.userId, referrerPubkey),
      });

      expect(referrerBalance?.balance).toBe(100);
      expect(referrerBalance?.totalEarned).toBe(100);
    });
  });
});

describe('GET /api/achievements/definitions', () => {
  let app: Hono;

  beforeEach(async () => {
    await db.delete(achievementDefinitions);

    app = new Hono();
    app.route('/api/achievements', achievementsRoute);
  });

  it('should return definitions without auth', async () => {
    await db.insert(achievementDefinitions).values([
      { type: 'first_correct', name: 'First Correct', description: 'Answer first question correctly', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } }, reward: 0 },
      { type: 'streak_5', name: '5 Streak', description: 'Get 5 correct in a row', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 5 } }, reward: 0 },
    ]);

    const res = await app.request('http://localhost/api/achievements/definitions');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty('type');
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('criteria');
  });

  it('should only return active definitions', async () => {
    await db.insert(achievementDefinitions).values([
      { type: 'active_one', name: 'Active', description: 'Active', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } }, reward: 0, active: true },
      { type: 'inactive_one', name: 'Inactive', description: 'Inactive', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } }, reward: 0, active: false },
    ]);

    const res = await app.request('http://localhost/api/achievements/definitions');
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].type).toBe('active_one');
  });

  it('should return empty array when no definitions exist', async () => {
    const res = await app.request('http://localhost/api/achievements/definitions');
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
