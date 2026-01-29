import { z } from 'zod';

/**
 * Trivia Question Schema
 * Represents a single trivia question with options and metadata.
 * NOTE: correctAnswer and explanation are server-only, NOT sent to frontend.
 */
export const triviaQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.enum(['basics', 'technical', 'history', 'lightning', 'culture']),
  level: z.number(),
});

export type TriviaQuestion = z.infer<typeof triviaQuestionSchema>;

/**
 * Trivia Session Schema
 * Response from POST /trivia/session/start
 */
export const triviaSessionSchema = z.object({
  sessionId: z.string(),
  questions: z.array(triviaQuestionSchema),
  level: z.number(),
  expiresAt: z.string(),
});

export type TriviaSession = z.infer<typeof triviaSessionSchema>;

/**
 * Trivia Answer Response Schema
 * Response from POST /trivia/session/answer
 */
export const triviaAnswerResponseSchema = z.object({
  correct: z.boolean(),
  explanation: z.string(),
  streak: z.number(),
  satsEarned: z.number(),
  levelUnlocked: z.boolean(),
});

export type TriviaAnswerResponse = z.infer<typeof triviaAnswerResponseSchema>;

/**
 * Trivia Progress Schema
 * Tracks user's progress and statistics in trivia games.
 * Field names match API response 1:1.
 */
export const triviaProgressSchema = z.object({
  currentLevel: z.number(),
  questionsAnswered: z.number(),
  correct: z.number(),
  streak: z.number(),
  bestStreak: z.number(),
  satsEarned: z.number(),
  levelCompleted: z.boolean(),
});

export type TriviaProgress = z.infer<typeof triviaProgressSchema>;
