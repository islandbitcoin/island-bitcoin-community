import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

export interface TriviaProgress {
  currentLevel: number;
  questionsAnswered: number;
  correct: number;
  streak: number;
  bestStreak: number;
  satsEarned: number;
  levelCompleted: boolean;
}

export interface TriviaQuestionsResponse {
  questions: TriviaQuestion[];
  level: number;
  progress: TriviaProgress | null;
}

export interface AnswerResponse {
  correct: boolean;
  streak: number;
  satsEarned: number;
  levelUnlocked: boolean;
}

async function fetchQuestions(
  level: number,
  pubkey: string
): Promise<TriviaQuestionsResponse> {
  const response = await fetch(`${API_BASE}/trivia/questions?level=${level}`, {
    headers: {
      Authorization: `Nostr ${pubkey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch questions");
  }

  return response.json();
}

async function submitAnswer(
  questionId: string,
  answer: number,
  level: number,
  pubkey: string
): Promise<AnswerResponse> {
  const response = await fetch(`${API_BASE}/trivia/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Nostr ${pubkey}`,
    },
    body: JSON.stringify({ questionId, answer, level }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit answer");
  }

  return response.json();
}

export function useTriviaQuestions(level: number) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["trivia-questions", level, user?.pubkey],
    queryFn: () => fetchQuestions(level, user!.pubkey),
    enabled: !!user?.pubkey && level > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitAnswer() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const submit = async (
    questionId: string,
    answer: number,
    level: number
  ): Promise<AnswerResponse> => {
    if (!user?.pubkey) {
      throw new Error("User not authenticated");
    }

    const result = await submitAnswer(questionId, answer, level, user.pubkey);

    queryClient.invalidateQueries({ queryKey: ["trivia-questions", level] });
    queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });

    return result;
  };

  return { submit, isAuthenticated: !!user?.pubkey };
}
