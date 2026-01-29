import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { users, triviaProgress, triviaSessions } from '../db/schema';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { creditReward } from '../services/rewards';
import { gameEventBus } from '../services/event-bus';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
  getQuestionsForLevel,
  getQuestionById,
  SAT_REWARDS,
  QUESTIONS_PER_LEVEL,
  MAX_LEVEL,
} from '../data/triviaQuestions';

export const triviaRoute = new Hono();

const SESSION_EXPIRY_MINUTES = 15;
const ANSWER_DELAY_MS = 3000;

const startRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  keyExtractor: (c) => {
    const pubkey = c.get('pubkey');
    if (pubkey) return pubkey;
    return c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      || c.req.header('CF-Connecting-IP')
      || 'unknown-guest';
  },
});
const answerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 120,
  keyExtractor: (c) => {
    const pubkey = c.get('pubkey');
    if (pubkey) return pubkey;
    return c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      || c.req.header('CF-Connecting-IP')
      || 'unknown-guest';
  },
});

const startSessionSchema = z.object({
  level: z.number().int().min(1).max(MAX_LEVEL),
});

const answerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.number().int().positive(),
  answer: z.number().int().min(0).max(3),
});

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

async function getOrCreateProgress(pubkey: string) {
  let progress = await db.query.triviaProgress.findFirst({
    where: (tp, { eq }) => eq(tp.userId, pubkey),
  });
  if (!progress) {
    await db.insert(users).values({ pubkey }).onConflictDoNothing();
    await db.insert(triviaProgress).values({
      userId: pubkey,
      level: 1,
      questionsAnswered: [],
      correct: 0,
      streak: 0,
      bestStreak: 0,
      satsEarned: 0,
      levelCompleted: false,
    });
    progress = await db.query.triviaProgress.findFirst({
      where: (tp, { eq }) => eq(tp.userId, pubkey),
    });
  }
  return progress!;
}

// POST /session/start
triviaRoute.post(
  '/session/start',
  optionalAuth,
  startRateLimiter,
  zValidator('json', startSessionSchema),
  async (c) => {
    const pubkey = c.get('pubkey') || 'guest';
    const isGuest = pubkey === 'guest';
    const { level } = c.req.valid('json');

    // For guests: only allow level 1
    if (isGuest && level !== 1) {
      throw new HTTPException(400, { message: 'Guests can only play level 1' });
    }

    // Ensure user exists in database (for foreign key constraint)
    if (isGuest) {
      await db.insert(users).values({ pubkey }).onConflictDoNothing();
    }

    // For authenticated users: check progress
    if (!isGuest) {
      const progress = await getOrCreateProgress(pubkey);
      if (level > progress.level) {
        throw new HTTPException(400, { message: 'Level not unlocked' });
      }

      // Check for existing active session
      const existingSession = await db.query.triviaSessions.findFirst({
        where: (ts, { eq, and }) => and(eq(ts.userId, pubkey), eq(ts.status, 'active')),
      });

      if (existingSession) {
        if (isExpired(existingSession.expiresAt)) {
          await db.update(triviaSessions)
            .set({ status: 'expired' })
            .where(eq(triviaSessions.id, existingSession.id));
        } else {
          throw new HTTPException(400, { message: 'Session already active' });
        }
      }
    }

    // Get questions for this level
    const allLevelQuestions = await getQuestionsForLevel(level);
    if (allLevelQuestions.length === 0) {
      throw new HTTPException(400, { message: 'No questions available for this level' });
    }

    // For authenticated users: filter out already answered questions
    let selectedQuestions = allLevelQuestions;
    if (!isGuest) {
      const progress = await getOrCreateProgress(pubkey);
      const answeredIds: number[] = progress.questionsAnswered || [];
      const unanswered = allLevelQuestions.filter(q => !answeredIds.includes(q.id));

      if (unanswered.length === 0) {
        throw new HTTPException(400, { message: 'Level already completed' });
      }

      // Shuffle and take up to QUESTIONS_PER_LEVEL
      selectedQuestions = unanswered.sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_LEVEL);
    } else {
      // For guests: shuffle and take up to QUESTIONS_PER_LEVEL
      selectedQuestions = allLevelQuestions.sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_LEVEL);
    }

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(triviaSessions).values({
      id: sessionId,
      userId: pubkey,
      level,
      questionIds: selectedQuestions.map(q => q.id),
      answers: [],
      expiresAt: expiresAt.toISOString(),
    });

    const sanitizedQuestions = selectedQuestions.map(({ correctAnswer, explanation, ...q }) => q);

    return c.json({
      sessionId,
      questions: sanitizedQuestions,
      level,
      expiresAt: expiresAt.toISOString(),
    });
  }
);

// GET /session/current
triviaRoute.get(
  '/session/current',
  requireAuth,
  async (c) => {
    const pubkey = c.get('pubkey')!;

    const session = await db.query.triviaSessions.findFirst({
      where: (ts, { eq, and }) => and(eq(ts.userId, pubkey), eq(ts.status, 'active')),
    });

    if (!session) {
      return c.json({ session: null }, 404);
    }

    if (isExpired(session.expiresAt)) {
      await db.update(triviaSessions)
        .set({ status: 'expired' })
        .where(eq(triviaSessions.id, session.id));
      return c.json({ session: null }, 404);
    }

    const questions = await Promise.all(
      session.questionIds.map(id => getQuestionById(id))
    );
    const sanitizedQuestions = questions
      .filter((q): q is NonNullable<typeof q> => q !== undefined)
      .map(({ correctAnswer, explanation, ...q }) => q);

    return c.json({
      sessionId: session.id,
      questions: sanitizedQuestions,
      level: session.level,
      expiresAt: session.expiresAt,
    });
  }
);

// POST /session/answer
triviaRoute.post(
  '/session/answer',
  optionalAuth,
  answerRateLimiter,
  zValidator('json', answerSchema),
  async (c) => {
    const pubkey = c.get('pubkey') || 'guest';
    const isGuest = pubkey === 'guest';
    const { sessionId, questionId, answer } = c.req.valid('json');

    const session = await db.query.triviaSessions.findFirst({
      where: (ts, { eq, and }) => and(eq(ts.id, sessionId), eq(ts.userId, pubkey)),
    });

    if (!session) {
      throw new HTTPException(400, { message: 'Invalid session' });
    }

    // Check expiry
    if (isExpired(session.expiresAt)) {
      if (session.status === 'active') {
        await db.update(triviaSessions)
          .set({ status: 'expired' })
          .where(eq(triviaSessions.id, sessionId));
      }
      throw new HTTPException(400, { message: 'Session expired' });
    }

    if (session.status !== 'active') {
      throw new HTTPException(400, { message: 'Session expired' });
    }

    // Check question belongs to session
    if (!session.questionIds.includes(questionId)) {
      throw new HTTPException(400, { message: 'Question not in session' });
    }

    // Check duplicate answer
    const answers = session.answers || [];
    if (answers.some(a => a.questionId === questionId)) {
      throw new HTTPException(400, { message: 'Question already answered' });
    }

    // Check answer delay (first answer is immediate, subsequent >= 3s)
    if (answers.length > 0) {
      const lastAnswer = answers[answers.length - 1];
      const lastAnsweredAt = new Date(lastAnswer.answeredAt).getTime();
      const now = Date.now();
      if (now - lastAnsweredAt < ANSWER_DELAY_MS) {
        throw new HTTPException(429, { message: 'Answer too fast' });
      }
    }

    const question = await getQuestionById(questionId);
    if (!question) {
      throw new HTTPException(400, { message: 'Question not found' });
    }

    const isCorrect = question.correctAnswer === answer;

    let satsEarned = 0;
    let newStreak = 0;
    let newBestStreak = 0;
    let newCorrect = 0;
    let newSatsEarned = 0;
    let levelUnlocked = false;
    let progress = null;

    // Only update progress for authenticated users
    if (!isGuest) {
      progress = await getOrCreateProgress(pubkey);
      newStreak = progress.streak;
      newBestStreak = progress.bestStreak;
      newCorrect = progress.correct;
      newSatsEarned = progress.satsEarned;

      if (isCorrect) {
        satsEarned = SAT_REWARDS[question.difficulty];
        newStreak = progress.streak + 1;
        newCorrect = progress.correct + 1;
        newSatsEarned = progress.satsEarned + satsEarned;
        if (newStreak > newBestStreak) {
          newBestStreak = newStreak;
        }

        const answeredIds: number[] = [...(progress.questionsAnswered || [])];
        if (!answeredIds.includes(questionId)) {
          answeredIds.push(questionId);
        }

        // Credit reward (has own transaction)
        await creditReward(pubkey, satsEarned, 'trivia');

        // Check level completion: all questions for this level answered correctly?
        const allLevelQuestions = await getQuestionsForLevel(session.level);
        const allLevelIds = allLevelQuestions.map(q => q.id);
        const allAnswered = allLevelIds.every(id => answeredIds.includes(id));

        if (allAnswered && session.level === progress.level) {
          // Level completed — increment level
          const newLevel = progress.level + 1;
          levelUnlocked = true;

          await db.update(triviaProgress)
            .set({
              level: newLevel,
              questionsAnswered: answeredIds,
              correct: newCorrect,
              streak: newStreak,
              bestStreak: newBestStreak,
              satsEarned: newSatsEarned,
              lastPlayedDate: new Date().toISOString().split('T')[0],
              levelCompleted: false,
            })
            .where(eq(triviaProgress.userId, pubkey));
        } else {
          await db.update(triviaProgress)
            .set({
              questionsAnswered: answeredIds,
              correct: newCorrect,
              streak: newStreak,
              bestStreak: newBestStreak,
              satsEarned: newSatsEarned,
              lastPlayedDate: new Date().toISOString().split('T')[0],
            })
            .where(eq(triviaProgress.userId, pubkey));
        }
      } else {
        newStreak = 0;
        await db.update(triviaProgress)
          .set({
            streak: 0,
            lastPlayedDate: new Date().toISOString().split('T')[0],
          })
          .where(eq(triviaProgress.userId, pubkey));
      }
    }

    // Append answer to session
    const newAnswers = [...answers, {
      questionId,
      answer,
      correct: isCorrect,
      answeredAt: new Date().toISOString(),
    }];

    const sessionComplete = newAnswers.length === session.questionIds.length;
    const updateData: Record<string, unknown> = { answers: newAnswers };
    if (sessionComplete) {
      updateData.status = 'completed';
      updateData.completedAt = new Date().toISOString();
    }

    await db.update(triviaSessions)
      .set(updateData)
      .where(eq(triviaSessions.id, sessionId));

    // Emit events AFTER all DB writes (only for authenticated users)
    if (!isGuest) {
      if (isCorrect) {
        gameEventBus.emit('trivia:correct', {
          pubkey,
          questionId,
          difficulty: question.difficulty,
          streak: newStreak,
          satsEarned,
        });
      } else {
        gameEventBus.emit('trivia:wrong', {
          pubkey,
          questionId,
          streak: newStreak,
        });
      }

      if (levelUnlocked && progress) {
        gameEventBus.emit('trivia:level-up', {
          pubkey,
          newLevel: progress.level + 1,
        });
      }

      if (sessionComplete) {
        const correctCount = newAnswers.filter(a => a.correct).length;
        gameEventBus.emit('trivia:session-complete', {
          pubkey,
          sessionId,
          score: correctCount,
          total: session.questionIds.length,
        });
      }
    }

    return c.json({
      correct: isCorrect,
      explanation: question.explanation,
      streak: newStreak,
      satsEarned,
      levelUnlocked,
    });
  }
);

// GET /session/:id
triviaRoute.get(
  '/session/:id',
  requireAuth,
  async (c) => {
    const pubkey = c.get('pubkey');
    const sessionId = c.req.param('id');

    const session = await db.query.triviaSessions.findFirst({
      where: (ts, { eq, and }) => and(eq(ts.id, sessionId), eq(ts.userId, pubkey)),
    });

    if (!session) {
      throw new HTTPException(404, { message: 'Session not found' });
    }

    // Lazy expiry check
    if (session.status === 'active' && isExpired(session.expiresAt)) {
      await db.update(triviaSessions)
        .set({ status: 'expired' })
        .where(eq(triviaSessions.id, sessionId));

      return c.json({
        sessionId: session.id,
        level: session.level,
        status: 'expired' as const,
        questionsTotal: session.questionIds.length,
        questionsAnswered: session.answers.length,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
      });
    }

    return c.json({
      sessionId: session.id,
      level: session.level,
      status: session.status,
      questionsTotal: session.questionIds.length,
      questionsAnswered: session.answers.length,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    });
  }
);

// GET /progress
triviaRoute.get(
  '/progress',
  requireAuth,
  async (c) => {
    const pubkey = c.get('pubkey');
    const progress = await getOrCreateProgress(pubkey);

    return c.json({
      currentLevel: progress.level,
      questionsAnswered: progress.questionsAnswered.length,
      correct: progress.correct,
      streak: progress.streak,
      bestStreak: progress.bestStreak,
      satsEarned: progress.satsEarned,
      levelCompleted: progress.levelCompleted,
    });
  }
);
