import { z } from 'zod';

/**
 * Trivia Question Schema
 * Represents a single trivia question with options and metadata
 */
export const triviaQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.enum(['basics', 'technical', 'history', 'lightning', 'culture']),
});

export type TriviaQuestion = z.infer<typeof triviaQuestionSchema>;

/**
 * Trivia Progress Schema
 * Tracks user's progress and statistics in trivia games
 */
export const triviaProgressSchema = z.object({
  totalQuestionsAnswered: z.number().int().nonnegative(),
  correctAnswers: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  lastPlayedDate: z.string(),
  answeredQuestions: z.array(z.string()),
  satsEarned: z.number().int().nonnegative(),
  currentLevel: z.number().int().positive(),
  levelCompleted: z.boolean(),
});

export type TriviaProgress = z.infer<typeof triviaProgressSchema>;
