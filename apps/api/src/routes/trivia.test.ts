import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { triviaRoute } from './trivia';
import { db } from '../db';
import { users, balances, triviaProgress, payouts, config } from '../db/schema';
import type { Event } from 'nostr-tools';

vi.mock('@island-bitcoin/nostr', () => ({
  verifyEvent: vi.fn(() => true),
}));

describe('GET /api/trivia/questions', () => {
  let app: Hono;
  const testPubkey = 'trivia_test_pubkey';

  beforeEach(async () => {
    await db.delete(triviaProgress);
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);

    app = new Hono();
    app.route('/api/trivia', triviaRoute);
  });

  function createAuthHeader(pubkey: string, method: string = 'GET', path: string = '/api/trivia/questions?level=1'): string {
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
      const res = await app.request('http://localhost/api/trivia/questions?level=1');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid Authorization header', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=1', {
        headers: { Authorization: 'Bearer invalid' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('should return 400 for missing level parameter', async () => {
      const res = await app.request('http://localhost/api/trivia/questions', {
        headers: { Authorization: createAuthHeader(testPubkey, 'GET', '/api/trivia/questions') },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for level < 1', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=0', {
        headers: { Authorization: createAuthHeader(testPubkey, 'GET', '/api/trivia/questions?level=0') },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for level > 21', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=22', {
        headers: { Authorization: createAuthHeader(testPubkey, 'GET', '/api/trivia/questions?level=22') },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for non-numeric level', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=abc', {
        headers: { Authorization: createAuthHeader(testPubkey, 'GET', '/api/trivia/questions?level=abc') },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('question retrieval', () => {
    it('should return 5 questions for level 1', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=1', {
        headers: { Authorization: createAuthHeader(testPubkey) },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.questions).toHaveLength(5);
      expect(body.level).toBe(1);
    });

    it('should return questions with correct structure (no correctAnswer)', async () => {
      const res = await app.request('http://localhost/api/trivia/questions?level=1', {
        headers: { Authorization: createAuthHeader(testPubkey) },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      for (const question of body.questions) {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('options');
        expect(question).toHaveProperty('difficulty');
        expect(question).toHaveProperty('category');
        expect(question).not.toHaveProperty('correctAnswer');
        expect(question).not.toHaveProperty('explanation');
        expect(question.options).toHaveLength(4);
      }
    });

    it('should return questions for all valid levels (1-21)', async () => {
      for (let level = 1; level <= 21; level++) {
        const path = `/api/trivia/questions?level=${level}`;
        const res = await app.request(`http://localhost${path}`, {
          headers: { Authorization: createAuthHeader(testPubkey, 'GET', path) },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.questions).toHaveLength(5);
        expect(body.level).toBe(level);
      }
    });

    it('should return user progress with questions', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 3,
        questionsAnswered: ['l1-q1', 'l1-q2'],
        correct: 2,
        streak: 2,
        bestStreak: 5,
        satsEarned: 10,
      });

      const res = await app.request('http://localhost/api/trivia/questions?level=1', {
        headers: { Authorization: createAuthHeader(testPubkey) },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.progress).toBeDefined();
      expect(body.progress.currentLevel).toBe(3);
      expect(body.progress.streak).toBe(2);
      expect(body.progress.bestStreak).toBe(5);
    });
  });
});

describe('POST /api/trivia/answer', () => {
  let app: Hono;
  const testPubkey = 'trivia_answer_pubkey';
  const adminPubkey = 'admin_pubkey_trivia';

  beforeEach(async () => {
    await db.delete(triviaProgress);
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);
    await db.delete(config);

    app = new Hono();
    app.route('/api/trivia', triviaRoute);

    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([adminPubkey]),
    });
  });

  function createAuthHeader(pubkey: string, method: string = 'POST', path: string = '/api/trivia/answer'): string {
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
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('should return 400 for missing questionId', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing level', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid questionId', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'invalid-id', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for answer out of range', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 5, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('correct answer handling', () => {
    it('should return correct=true for correct answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.correct).toBe(true);
      expect(body.satsEarned).toBe(5);
      expect(body.streak).toBe(1);
    });

    it('should award 5 sats for easy question', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.satsEarned).toBe(5);
    });

    it('should award 10 sats for medium question', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l8-q1', answer: 1, level: 8 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.satsEarned).toBe(10);
    });

    it('should award 15 sats for hard question', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l15-q1', answer: 1, level: 15 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.satsEarned).toBe(15);
    });

    it('should increment streak on correct answer', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: [],
        correct: 0,
        streak: 3,
        bestStreak: 5,
        satsEarned: 0,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.streak).toBe(4);
    });

    it('should update best streak when current exceeds it', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: [],
        correct: 0,
        streak: 5,
        bestStreak: 5,
        satsEarned: 0,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.streak).toBe(6);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.bestStreak).toBe(6);
    });

    it('should update balance on correct answer', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, testPubkey),
      });
      expect(balance?.balance).toBe(105);
      expect(balance?.totalEarned).toBe(105);
    });

    it('should create payout record on correct answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const payout = await db.query.payouts.findFirst({
        where: (p, { eq }) => eq(p.userId, testPubkey),
      });
      expect(payout).toBeDefined();
      expect(payout?.amount).toBe(5);
      expect(payout?.gameType).toBe('trivia');
      expect(payout?.status).toBe('paid');
    });
  });

  describe('wrong answer handling', () => {
    it('should return correct=false for wrong answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.correct).toBe(false);
      expect(body.satsEarned).toBe(0);
      expect(body.streak).toBe(0);
    });

    it('should reset streak to 0 on wrong answer', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: [],
        correct: 5,
        streak: 10,
        bestStreak: 15,
        satsEarned: 50,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.streak).toBe(0);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.streak).toBe(0);
      expect(progress?.bestStreak).toBe(15);
    });

    it('should not award sats on wrong answer', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(balances).values({
        userId: testPubkey,
        balance: 100,
        pending: 0,
        totalEarned: 100,
        totalWithdrawn: 0,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, testPubkey),
      });
      expect(balance?.balance).toBe(100);
    });

    it('should not create payout record on wrong answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const payoutCount = await db.query.payouts.findMany({
        where: (p, { eq }) => eq(p.userId, testPubkey),
      });
      expect(payoutCount).toHaveLength(0);
    });
  });

  describe('level progression', () => {
    it('should unlock next level when all questions answered correctly', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: ['l1-q1', 'l1-q2', 'l1-q3', 'l1-q4'],
        correct: 4,
        streak: 4,
        bestStreak: 4,
        satsEarned: 20,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q5', answer: 2, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.levelUnlocked).toBe(true);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.level).toBe(2);
      expect(progress?.levelCompleted).toBe(true);
    });

    it('should not unlock next level if not all questions answered', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: ['l1-q1', 'l1-q2'],
        correct: 2,
        streak: 2,
        bestStreak: 2,
        satsEarned: 10,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q3', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.levelUnlocked).toBe(false);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.level).toBe(1);
    });

    it('should not exceed max level 21', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 21,
        questionsAnswered: ['l21-q1', 'l21-q2', 'l21-q3', 'l21-q4'],
        correct: 100,
        streak: 4,
        bestStreak: 50,
        satsEarned: 1000,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l21-q5', answer: 1, level: 21 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.levelUnlocked).toBe(false);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.level).toBe(21);
    });
  });

  describe('progress tracking', () => {
    it('should track answered questions', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.questionsAnswered).toContain('l1-q1');
    });

    it('should prevent answering same question twice', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: ['l1-q1'],
        correct: 1,
        streak: 1,
        bestStreak: 1,
        satsEarned: 5,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(400);
    });

    it('should create new progress record for new user', async () => {
      const newPubkey = 'brand_new_user';

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(newPubkey),
        },
      });

      expect(res.status).toBe(200);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, newPubkey),
      });
      expect(progress).toBeDefined();
      expect(progress?.level).toBe(1);
    });

    it('should update satsEarned in progress', async () => {
      await db.insert(users).values({ pubkey: testPubkey });
      await db.insert(triviaProgress).values({
        userId: testPubkey,
        level: 1,
        questionsAnswered: [],
        correct: 0,
        streak: 0,
        bestStreak: 0,
        satsEarned: 50,
      });

      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);

      const progress = await db.query.triviaProgress.findFirst({
        where: (tp, { eq }) => eq(tp.userId, testPubkey),
      });
      expect(progress?.satsEarned).toBe(55);
    });
  });

  describe('response structure', () => {
    it('should return correct response structure for correct answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 0, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty('correct');
      expect(body).toHaveProperty('streak');
      expect(body).toHaveProperty('satsEarned');
      expect(body).toHaveProperty('levelUnlocked');
      expect(typeof body.correct).toBe('boolean');
      expect(typeof body.streak).toBe('number');
      expect(typeof body.satsEarned).toBe('number');
      expect(typeof body.levelUnlocked).toBe('boolean');
    });

    it('should return correct response structure for wrong answer', async () => {
      const res = await app.request('http://localhost/api/trivia/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'l1-q1', answer: 1, level: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: createAuthHeader(testPubkey),
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.correct).toBe(false);
      expect(body.streak).toBe(0);
      expect(body.satsEarned).toBe(0);
      expect(body.levelUnlocked).toBe(false);
    });
  });
});
