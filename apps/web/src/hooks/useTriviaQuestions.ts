import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { createNIP98AuthHeader } from "@/lib/nip98";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function buildNip98Url(apiPath: string): string {
  return apiPath.startsWith("http")
    ? apiPath
    : `${window.location.origin}${apiPath}`;
}

export interface TriviaQuestion {
  id: number;
  question: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  category: string;
  level: number;
}

export interface TriviaSession {
  sessionId: string;
  questions: TriviaQuestion[];
  level: number;
  expiresAt: string;
}

export interface TriviaAnswerResponse {
  correct: boolean;
  explanation: string;
  streak: number;
  satsEarned: number;
  levelUnlocked: boolean;
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

export class TriviaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TriviaApiError";
    this.status = status;
  }
}

async function startSession(level: number, user?: { pubkey: string; signer?: any }): Promise<TriviaSession> {
  const apiPath = `${API_BASE}/trivia/session/start`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (user?.pubkey) {
    const nip98Url = buildNip98Url(apiPath);
    // Use provided signer or fall back to window.nostr for extension users
    const signer = user.signer || (window.nostr as any);
    const authHeader = await createNIP98AuthHeader(nip98Url, "POST", signer);
    headers.Authorization = authHeader;
  }

  const response = await fetch(apiPath, {
    method: "POST",
    headers,
    body: JSON.stringify({ level }),
  });

  if (!response.ok) {
    throw new TriviaApiError(
      response.status === 429
        ? "Rate limited. Please slow down."
        : "Failed to start session",
      response.status
    );
  }

  return response.json();
}

async function submitAnswer(
  sessionId: string,
  questionId: number,
  answer: number,
  user?: { pubkey: string; signer?: any }
): Promise<TriviaAnswerResponse> {
  const apiPath = `${API_BASE}/trivia/session/answer`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (user?.pubkey) {
    const nip98Url = buildNip98Url(apiPath);
    // Use provided signer or fall back to window.nostr for extension users
    const signer = user.signer || (window.nostr as any);
    const authHeader = await createNIP98AuthHeader(nip98Url, "POST", signer);
    headers.Authorization = authHeader;
  }

  const response = await fetch(apiPath, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, questionId, answer }),
  });

  if (!response.ok) {
    if (response.status === 410 || response.status === 400) {
      const body = await response.json().catch(() => ({}));
      throw new TriviaApiError(
        body.error || "Session expired",
        response.status
      );
    }
    throw new TriviaApiError("Failed to submit answer", response.status);
  }

  return response.json();
}

async function fetchProgress(signer?: any): Promise<TriviaProgress> {
  const apiPath = `${API_BASE}/trivia/progress`;
  const nip98Url = buildNip98Url(apiPath);
  
  // Use provided signer or fall back to window.nostr for extension users
  const authHeader = await createNIP98AuthHeader(nip98Url, "GET", signer || (window.nostr as any));

  const response = await fetch(apiPath, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    throw new TriviaApiError("Failed to fetch progress", response.status);
  }

  return response.json();
}

export function useStartSession() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const start = async (level: number): Promise<TriviaSession> => {
    const session = await startSession(level, user || undefined);
    if (user?.pubkey) {
      queryClient.invalidateQueries({ queryKey: ["trivia-progress"] });
    }
    return session;
  };

  return { start, isAuthenticated: !!user?.pubkey };
}

export function useSubmitAnswer() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const submit = async (
    sessionId: string,
    questionId: number,
    answer: number
  ): Promise<TriviaAnswerResponse> => {
    const result = await submitAnswer(sessionId, questionId, answer, user || undefined);

    if (user?.pubkey) {
      queryClient.invalidateQueries({ queryKey: ["trivia-progress"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    }

    return result;
  };

  return { submit, isAuthenticated: !!user?.pubkey };
}

export function useTriviaProgress() {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["trivia-progress", user?.pubkey],
    queryFn: () => fetchProgress(user?.signer),
    enabled: !!user?.pubkey,
    staleTime: 30 * 1000,
  });
}
