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
  triviaProgressSchema,
  type TriviaQuestion,
  type TriviaProgress,
} from './schemas/trivia';

// Leaderboard schemas
export {
  leaderboardEntrySchema,
  type LeaderboardEntry,
} from './schemas/leaderboard';
