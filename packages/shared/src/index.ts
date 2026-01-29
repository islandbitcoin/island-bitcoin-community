// Wallet schemas
export {
  gameWalletConfigSchema,
  userBalanceSchema,
  gamePayoutSchema,
  type GameWalletConfig,
  type UserBalance,
  type GamePayout,
} from './schemas/wallet';

// Trivia schemas
export {
  triviaQuestionSchema,
  triviaSessionSchema,
  triviaAnswerResponseSchema,
  triviaProgressSchema,
  type TriviaQuestion,
  type TriviaSession,
  type TriviaAnswerResponse,
  type TriviaProgress,
} from './schemas/trivia';

// Leaderboard schemas
export {
  leaderboardEntrySchema,
  type LeaderboardEntry,
} from './schemas/leaderboard';
