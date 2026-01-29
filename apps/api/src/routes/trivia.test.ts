import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { triviaRoute } from './trivia';
import { db } from '../db';
import { users, balances, triviaProgress, payouts, triviaSessions, questions } from '../db/schema';
import { TRIVIA_QUESTIONS } from '../data/triviaQuestions';
import { gameEventBus } from '../services/event-bus';
import { sql } from 'drizzle-orm';
import type { Event } from 'nostr-tools';

vi.mock('@island-bitcoin/nostr', () => ({
  verifyEvent: vi.fn(() => true),
}));

vi.mock('../middleware/rate-limit', () => ({
  createRateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

function createAuthHeader(pubkey: string, method: string = 'GET', path: string = '/'): string {
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
  return `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
}

async function seedQuestions() {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(questions);
  if (row.count > 0) return;
  const rows = TRIVIA_QUESTIONS.map((q) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    category: q.category,
    level: q.level,
  }));
  await db.insert(questions).values(rows);
}

describe('Trivia Session System', () => {
  let app: Hono;
  const pubkey = 'test_trivia_session_pubkey';

  beforeEach(async () => {
    vi.useRealTimers();
    await db.delete(triviaSessions);
    await db.delete(triviaProgress);
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);
    await seedQuestions();

    app = new Hono();
    app.route('/api/trivia', triviaRoute);
  });

  afterEach(() => {
    gameEventBus.removeAllListeners();
  });

  async function startSession(level = 1, userPubkey = pubkey) {
    const path = '/api/trivia/session/start';
    return app.request(`http://localhost${path}`, {
      method: 'POST',
      body: JSON.stringify({ level }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: createAuthHeader(userPubkey, 'POST', path),
      },
    });
  }

  async function answerQuestion(sessionId: string, questionId: number, answer: number, userPubkey = pubkey) {
    const path = '/api/trivia/session/answer';
    return app.request(`http://localhost${path}`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, questionId, answer }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: createAuthHeader(userPubkey, 'POST', path),
      },
    });
  }

  async function getSession(sessionId: string, userPubkey = pubkey) {
    const path = `/api/trivia/session/${sessionId}`;
    return app.request(`http://localhost${path}`, {
      headers: {
        Authorization: createAuthHeader(userPubkey, 'GET', path),
      },
    });
  }

  async function getProgress(userPubkey = pubkey) {
    const path = '/api/trivia/progress';
    return app.request(`http://localhost${path}`, {
      headers: {
        Authorization: createAuthHeader(userPubkey, 'GET', path),
      },
    });
  }

  describe('POST /session/start', () => {
    it('should create a session and return sanitized questions', async () => {
      const res = await startSession(1);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.sessionId).toBeDefined();
      expect(body.level).toBe(1);
      expect(body.expiresAt).toBeDefined();
      expect(body.questions.length).toBeGreaterThan(0);
      expect(body.questions.length).toBeLessThanOrEqual(5);

      for (const q of body.questions) {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('question');
        expect(q).toHaveProperty('options');
        expect(q).not.toHaveProperty('correctAnswer');
        expect(q).not.toHaveProperty('explanation');
      }
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('http://localhost/api/trivia/session/start', {
        method: 'POST',
        body: JSON.stringify({ level: 1 }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('should fail if user already has active session', async () => {
      const res1 = await startSession(1);
      expect(res1.status).toBe(200);

      const res2 = await startSession(1);
      expect(res2.status).toBe(400);
      expect(await res2.text()).toContain('Session already active');
    });

    it('should fail if level not unlocked', async () => {
      const res = await startSession(3);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Level not unlocked');
    });

    it('should expire old session and allow new one', async () => {
      vi.useFakeTimers();
      const res1 = await startSession(1);
      expect(res1.status).toBe(200);

      vi.advanceTimersByTime(16 * 60 * 1000);

      const res2 = await startSession(1);
      expect(res2.status).toBe(200);
      vi.useRealTimers();
    });

    it('should return 400 when level already completed', async () => {
      await db.insert(users).values({ pubkey }).onConflictDoNothing();

      const allL1 = await db.query.questions.findMany({
        where: (q, { eq }) => eq(q.level, 1),
      });

      await db.insert(triviaProgress).values({
        userId: pubkey,
        level: 2,
        questionsAnswered: allL1.map(q => q.id),
        correct: allL1.length,
        streak: 0,
        bestStreak: allL1.length,
        satsEarned: allL1.length * 5,
        levelCompleted: false,
      });

      const res = await startSession(1);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Level already completed');
    });
  });

  describe('POST /session/answer', () => {
    it('should accept correct answer and return sats', async () => {
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      const q = qs[0];
      const dbQuestion = await db.query.questions.findFirst({
        where: (qr, { eq }) => eq(qr.id, q.id),
      });

      const res = await answerQuestion(sessionId, q.id, dbQuestion!.correctAnswer);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.correct).toBe(true);
      expect(body.satsEarned).toBe(5);
      expect(body.streak).toBe(1);
      expect(body.explanation).toBeDefined();
    });

    it('should handle wrong answer - reset streak, no sats', async () => {
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      const q = qs[0];
      const dbQuestion = await db.query.questions.findFirst({
        where: (qr, { eq }) => eq(qr.id, q.id),
      });
      const wrongAnswer = (dbQuestion!.correctAnswer + 1) % 4;

      const res = await answerQuestion(sessionId, q.id, wrongAnswer);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.correct).toBe(false);
      expect(body.satsEarned).toBe(0);
      expect(body.streak).toBe(0);
    });

    it('should return 400 for expired session', async () => {
      vi.useFakeTimers();
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      vi.advanceTimersByTime(16 * 60 * 1000);

      const res = await answerQuestion(sessionId, qs[0].id, 0);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Session expired');
      vi.useRealTimers();
    });

    it('should return 400 for duplicate answer', async () => {
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      await answerQuestion(sessionId, qs[0].id, 0);

      const res = await answerQuestion(sessionId, qs[0].id, 0);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Question already answered');
    });

    it('should return 400 for question not in session', async () => {
      const startRes = await startSession(1);
      const { sessionId } = await startRes.json();

      const res = await answerQuestion(sessionId, 999999, 0);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Question not in session');
    });

    it('should return 400 for invalid session', async () => {
      const res = await answerQuestion('00000000-0000-0000-0000-000000000000', 1, 0);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('Invalid session');
    });

    it('should return 429 for answer too fast', async () => {
      vi.useFakeTimers();
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      await answerQuestion(sessionId, qs[0].id, 0);

      const res = await answerQuestion(sessionId, qs[1].id, 0);
      expect(res.status).toBe(429);
      expect(await res.text()).toContain('Answer too fast');
      vi.useRealTimers();
    });

    it('should allow first answer immediately (no delay)', async () => {
      vi.useFakeTimers();
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      const res = await answerQuestion(sessionId, qs[0].id, 0);
      expect(res.status).toBe(200);
      vi.useRealTimers();
    });

    it('should allow answer after 3s delay', async () => {
      vi.useFakeTimers();
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      await answerQuestion(sessionId, qs[0].id, 0);
      vi.advanceTimersByTime(3000);

      const res = await answerQuestion(sessionId, qs[1].id, 0);
      expect(res.status).toBe(200);
      vi.useRealTimers();
    });
  });

  describe('session completion', () => {
    it('should mark session completed when all questions answered', async () => {
      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      vi.useFakeTimers();
      for (let i = 0; i < qs.length; i++) {
        if (i > 0) vi.advanceTimersByTime(3000);
        await answerQuestion(sessionId, qs[i].id, 0);
      }
      vi.useRealTimers();

      const sessRes = await getSession(sessionId);
      const sessBody = await sessRes.json();
      expect(sessBody.status).toBe('completed');
      expect(sessBody.questionsAnswered).toBe(qs.length);
    });

    it('should emit trivia:session-complete event', async () => {
      const events: unknown[] = [];
      gameEventBus.on('trivia:session-complete', (payload) => events.push(payload));

      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();

      vi.useFakeTimers();
      for (let i = 0; i < qs.length; i++) {
        if (i > 0) vi.advanceTimersByTime(3000);
        await answerQuestion(sessionId, qs[i].id, 0);
      }
      vi.useRealTimers();

      expect(events).toHaveLength(1);
      const ev = events[0] as { pubkey: string; sessionId: string; score: number; total: number };
      expect(ev.sessionId).toBe(sessionId);
      expect(ev.total).toBe(qs.length);
    });
  });

  describe('level progression', () => {
    it('should unlock next level when all level questions answered correctly across sessions', async () => {
      const allL1 = await db.query.questions.findMany({
        where: (q, { eq }) => eq(q.level, 1),
      });

      let answeredSoFar = 0;
      while (answeredSoFar < allL1.length) {
        const startRes = await startSession(1);
        expect(startRes.status).toBe(200);
        const { sessionId, questions: qs } = await startRes.json();

        vi.useFakeTimers();
        for (let i = 0; i < qs.length; i++) {
          if (i > 0) vi.advanceTimersByTime(3000);
          const dbQ = await db.query.questions.findFirst({
            where: (qr, { eq }) => eq(qr.id, qs[i].id),
          });
          await answerQuestion(sessionId, qs[i].id, dbQ!.correctAnswer);
          answeredSoFar++;
        }
        vi.useRealTimers();
      }

      const progressRes = await getProgress();
      const progressBody = await progressRes.json();
      expect(progressBody.currentLevel).toBe(2);
    });

    it('should emit trivia:level-up event', async () => {
      const events: unknown[] = [];
      gameEventBus.on('trivia:level-up', (payload) => events.push(payload));

      const allL1 = await db.query.questions.findMany({
        where: (q, { eq }) => eq(q.level, 1),
      });

      let answeredSoFar = 0;
      while (answeredSoFar < allL1.length) {
        const startRes = await startSession(1);
        const { sessionId, questions: qs } = await startRes.json();

        vi.useFakeTimers();
        for (let i = 0; i < qs.length; i++) {
          if (i > 0) vi.advanceTimersByTime(3000);
          const dbQ = await db.query.questions.findFirst({
            where: (qr, { eq }) => eq(qr.id, qs[i].id),
          });
          await answerQuestion(sessionId, qs[i].id, dbQ!.correctAnswer);
          answeredSoFar++;
        }
        vi.useRealTimers();
      }

      expect(events.length).toBeGreaterThan(0);
      const ev = events[0] as { pubkey: string; newLevel: number };
      expect(ev.newLevel).toBe(2);
    });
  });

  describe('GET /session/:id', () => {
    it('should return session status', async () => {
      const startRes = await startSession(1);
      const { sessionId } = await startRes.json();

      const res = await getSession(sessionId);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionId).toBe(sessionId);
      expect(body.status).toBe('active');
      expect(body.questionsTotal).toBeGreaterThan(0);
      expect(body.questionsAnswered).toBe(0);
    });

    it('should lazily expire session on GET', async () => {
      vi.useFakeTimers();
      const startRes = await startSession(1);
      const { sessionId } = await startRes.json();

      vi.advanceTimersByTime(16 * 60 * 1000);

      const res = await getSession(sessionId);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('expired');
      vi.useRealTimers();
    });

    it('should return 404 for non-existent session', async () => {
      const res = await getSession('00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /progress', () => {
    it('should return default progress for new user', async () => {
      const res = await getProgress();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.currentLevel).toBe(1);
      expect(body.questionsAnswered).toBe(0);
      expect(body.correct).toBe(0);
      expect(body.streak).toBe(0);
      expect(body.bestStreak).toBe(0);
      expect(body.satsEarned).toBe(0);
      expect(body.levelCompleted).toBe(false);
    });

    it('should return 401 without auth', async () => {
      const res = await app.request('http://localhost/api/trivia/progress');
      expect(res.status).toBe(401);
    });
  });

  describe('event emission', () => {
    it('should emit trivia:correct on correct answer', async () => {
      const events: unknown[] = [];
      gameEventBus.on('trivia:correct', (payload) => events.push(payload));

      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();
      const dbQ = await db.query.questions.findFirst({
        where: (qr, { eq }) => eq(qr.id, qs[0].id),
      });

      await answerQuestion(sessionId, qs[0].id, dbQ!.correctAnswer);

      expect(events).toHaveLength(1);
      const ev = events[0] as { pubkey: string; satsEarned: number };
      expect(ev.pubkey).toBe(pubkey);
      expect(ev.satsEarned).toBe(5);
    });

    it('should emit trivia:wrong on wrong answer', async () => {
      const events: unknown[] = [];
      gameEventBus.on('trivia:wrong', (payload) => events.push(payload));

      const startRes = await startSession(1);
      const { sessionId, questions: qs } = await startRes.json();
      const dbQ = await db.query.questions.findFirst({
        where: (qr, { eq }) => eq(qr.id, qs[0].id),
      });
      const wrongAnswer = (dbQ!.correctAnswer + 1) % 4;

      await answerQuestion(sessionId, qs[0].id, wrongAnswer);

      expect(events).toHaveLength(1);
      const ev = events[0] as { pubkey: string; streak: number };
      expect(ev.pubkey).toBe(pubkey);
      expect(ev.streak).toBe(0);
    });
  });
});
