import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { users, balances, triviaProgress, payouts } from '../db/schema';
import { requireAuth } from '../middleware/auth';
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

const questionsQuerySchema = z.object({
  level: z.coerce.number().int().min(1).max(MAX_LEVEL),
});

triviaRoute.get(
  '/questions',
  requireAuth,
  zValidator('query', questionsQuerySchema),
  async (c) => {
    const pubkey = c.get('pubkey');
    const { level } = c.req.valid('query');

    const questions = getQuestionsForLevel(level);

    if (questions.length === 0) {
      throw new HTTPException(400, { message: `No questions found for level ${level}` });
    }

    const sanitizedQuestions = questions.map(({ correctAnswer, explanation, ...q }) => q);

    let progress = await db.query.triviaProgress.findFirst({
      where: (tp, { eq }) => eq(tp.userId, pubkey),
    });

    let progressResponse = null;
    if (progress) {
      progressResponse = {
        currentLevel: progress.level,
        questionsAnswered: progress.questionsAnswered,
        correct: progress.correct,
        streak: progress.streak,
        bestStreak: progress.bestStreak,
        satsEarned: progress.satsEarned,
        levelCompleted: progress.levelCompleted,
      };
    }

    return c.json({
      questions: sanitizedQuestions,
      level,
      progress: progressResponse,
    });
  }
);

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.number().int().min(0).max(3),
  level: z.number().int().min(1).max(MAX_LEVEL),
});

triviaRoute.post(
  '/answer',
  requireAuth,
  zValidator('json', answerSchema),
  async (c) => {
    const pubkey = c.get('pubkey');
    const { questionId, answer, level } = c.req.valid('json');

    const question = getQuestionById(questionId);
    if (!question) {
      throw new HTTPException(400, { message: 'Invalid question ID' });
    }

    let user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.pubkey, pubkey),
    });

    if (!user) {
      await db.insert(users).values({ pubkey });
    }

    let progress = await db.query.triviaProgress.findFirst({
      where: (tp, { eq }) => eq(tp.userId, pubkey),
    });

    if (!progress) {
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

    const answeredQuestions: string[] = progress!.questionsAnswered || [];
    if (answeredQuestions.includes(questionId)) {
      throw new HTTPException(400, { message: 'Question already answered' });
    }

    const isCorrect = question.correctAnswer === answer;
    let satsEarned = 0;
    let newStreak = progress!.streak;
    let newBestStreak = progress!.bestStreak;
    let levelUnlocked = false;
    let newLevel = progress!.level;
    let newCorrect = progress!.correct;
    let newSatsEarned = progress!.satsEarned;

    answeredQuestions.push(questionId);

    if (isCorrect) {
      satsEarned = SAT_REWARDS[question.difficulty];
      newStreak = progress!.streak + 1;
      newCorrect = progress!.correct + 1;
      newSatsEarned = progress!.satsEarned + satsEarned;

      if (newStreak > newBestStreak) {
        newBestStreak = newStreak;
      }

      let balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, pubkey),
      });

      if (!balance) {
        await db.insert(balances).values({
          userId: pubkey,
          balance: 0,
          pending: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });

        balance = await db.query.balances.findFirst({
          where: (b, { eq }) => eq(b.userId, pubkey),
        });
      }

      const payoutId = randomUUID();
      const now = new Date().toISOString();

      await db.insert(payouts).values({
        id: payoutId,
        userId: pubkey,
        amount: satsEarned,
        gameType: 'trivia',
        status: 'paid',
        timestamp: now,
      });

      await db.update(balances)
        .set({
          balance: balance!.balance + satsEarned,
          totalEarned: balance!.totalEarned + satsEarned,
          lastActivity: now,
        })
        .where(eq(balances.userId, pubkey));

      const levelQuestions = answeredQuestions.filter(q => q.startsWith(`l${level}-`));
      if (levelQuestions.length >= QUESTIONS_PER_LEVEL && newLevel < MAX_LEVEL) {
        newLevel = progress!.level + 1;
        levelUnlocked = true;
      }
    } else {
      newStreak = 0;
    }

    const now = new Date().toISOString().split('T')[0];

    await db.update(triviaProgress)
      .set({
        level: newLevel,
        questionsAnswered: answeredQuestions,
        correct: newCorrect,
        streak: newStreak,
        bestStreak: newBestStreak,
        satsEarned: newSatsEarned,
        lastPlayedDate: now,
        levelCompleted: levelUnlocked || progress!.levelCompleted,
      })
      .where(eq(triviaProgress.userId, pubkey));

    return c.json({
      correct: isCorrect,
      streak: newStreak,
      satsEarned,
      levelUnlocked,
    });
  }
);
