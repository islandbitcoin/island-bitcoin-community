import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { leaderboardRoute } from './leaderboard';
import { db } from '../db';
import { users, payouts } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('GET /api/leaderboard', () => {
  let app: Hono;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(payouts);
    await db.delete(users);

    // Create test users
    await db.insert(users).values([
      { pubkey: 'user1' },
      { pubkey: 'user2' },
      { pubkey: 'user3' },
      { pubkey: 'user4' },
      { pubkey: 'user5' },
    ]);

    // Set up app with route
    app = new Hono();
    app.route('/api/leaderboard', leaderboardRoute);
  });

  describe('daily timeframe', () => {
    it('should return top 10 users for today only', async () => {
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      // Today's payouts
      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: today.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'trivia', status: 'paid', timestamp: today.toISOString() },
        { id: '3', userId: 'user2', amount: 75, gameType: 'stacker', status: 'paid', timestamp: today.toISOString() },
        // Yesterday's payout (should be excluded)
        { id: '4', userId: 'user3', amount: 200, gameType: 'trivia', status: 'paid', timestamp: yesterday.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=daily');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(2);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 150,
        gameCount: 2,
      });
      expect(body[1]).toEqual({
        pubkey: 'user2',
        score: 75,
        gameCount: 1,
      });
    });

    it('should exclude withdrawal payouts', async () => {
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: today.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'withdrawal', status: 'paid', timestamp: today.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=daily');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 100,
        gameCount: 1,
      });
    });

    it('should only include paid payouts', async () => {
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: today.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'trivia', status: 'pending', timestamp: today.toISOString() },
        { id: '3', userId: 'user1', amount: 25, gameType: 'trivia', status: 'failed', timestamp: today.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=daily');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 100,
        gameCount: 1,
      });
    });

    it('should return empty array when no payouts today', async () => {
      const res = await app.request('http://localhost/api/leaderboard?timeframe=daily');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toEqual([]);
    });
  });

  describe('weekly timeframe', () => {
    it('should return top 10 users for current week (Sunday start)', async () => {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek));
      const lastWeek = new Date(startOfWeek);
      lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);

      // This week's payouts
      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: startOfWeek.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '3', userId: 'user2', amount: 75, gameType: 'stacker', status: 'paid', timestamp: now.toISOString() },
        // Last week's payout (should be excluded)
        { id: '4', userId: 'user3', amount: 200, gameType: 'trivia', status: 'paid', timestamp: lastWeek.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=weekly');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(2);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 150,
        gameCount: 2,
      });
      expect(body[1]).toEqual({
        pubkey: 'user2',
        score: 75,
        gameCount: 1,
      });
    });

    it('should exclude withdrawal payouts', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'withdrawal', status: 'paid', timestamp: now.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=weekly');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 100,
        gameCount: 1,
      });
    });
  });

  describe('alltime timeframe', () => {
    it('should return top 10 users all-time', async () => {
      const now = new Date();
      const longAgo = new Date('2020-01-01T00:00:00Z');

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'trivia', status: 'paid', timestamp: longAgo.toISOString() },
        { id: '3', userId: 'user2', amount: 75, gameType: 'stacker', status: 'paid', timestamp: longAgo.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=alltime');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(2);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 150,
        gameCount: 2,
      });
      expect(body[1]).toEqual({
        pubkey: 'user2',
        score: 75,
        gameCount: 1,
      });
    });

    it('should exclude withdrawal payouts', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '2', userId: 'user1', amount: 50, gameType: 'withdrawal', status: 'paid', timestamp: now.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=alltime');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 100,
        gameCount: 1,
      });
    });

    it('should limit results to top 10', async () => {
      const now = new Date();

      // Create 15 users with payouts
      const payoutData = [];
      for (let i = 1; i <= 15; i++) {
        await db.insert(users).values({ pubkey: `user${i + 5}` });
        payoutData.push({
          id: `payout${i}`,
          userId: `user${i + 5}`,
          amount: 100 - i,
          gameType: 'trivia' as const,
          status: 'paid' as const,
          timestamp: now.toISOString(),
        });
      }
      await db.insert(payouts).values(payoutData);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=alltime');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(10);
      // Verify sorted by score DESC
      expect(body[0].score).toBe(99);
      expect(body[9].score).toBe(90);
    });
  });

  describe('validation', () => {
    it('should reject invalid timeframe', async () => {
      const res = await app.request('http://localhost/api/leaderboard?timeframe=invalid');
      
      expect(res.status).toBe(400);
    });

    it('should default to alltime when timeframe not provided', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 100, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
    });
  });

  describe('sorting and aggregation', () => {
    it('should sort by score DESC', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 50, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '2', userId: 'user2', amount: 100, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '3', userId: 'user3', amount: 75, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=alltime');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body[0].pubkey).toBe('user2');
      expect(body[1].pubkey).toBe('user3');
      expect(body[2].pubkey).toBe('user1');
    });

    it('should aggregate multiple payouts per user', async () => {
      const now = new Date();

      await db.insert(payouts).values([
        { id: '1', userId: 'user1', amount: 10, gameType: 'trivia', status: 'paid', timestamp: now.toISOString() },
        { id: '2', userId: 'user1', amount: 20, gameType: 'stacker', status: 'paid', timestamp: now.toISOString() },
        { id: '3', userId: 'user1', amount: 30, gameType: 'achievement', status: 'paid', timestamp: now.toISOString() },
        { id: '4', userId: 'user1', amount: 40, gameType: 'referral', status: 'paid', timestamp: now.toISOString() },
      ]);

      const res = await app.request('http://localhost/api/leaderboard?timeframe=alltime');
      
      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        pubkey: 'user1',
        score: 100,
        gameCount: 4,
      });
    });
  });
});
