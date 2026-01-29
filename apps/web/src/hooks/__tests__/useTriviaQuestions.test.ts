import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCreateNIP98AuthHeader = vi.fn();

vi.mock("@/lib/nip98", () => ({
  createNIP98AuthHeader: (...args: unknown[]) => mockCreateNIP98AuthHeader(...args),
}));

vi.mock("../useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: { pubkey: "test-pubkey-123" },
  })),
}));

import {
  useStartSession,
  useSubmitAnswer,
  useTriviaProgress,
  TriviaApiError,
} from "../useTriviaQuestions";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const mockSession = {
  sessionId: "session-123",
  questions: [
    {
      id: 1,
      question: "Test?",
      options: ["A", "B", "C", "D"],
      difficulty: "easy",
      category: "basics",
      level: 1,
    },
  ],
  level: 1,
  expiresAt: new Date(Date.now() + 600000).toISOString(),
};

describe("useTriviaQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockCreateNIP98AuthHeader.mockResolvedValue("Nostr test-auth-header");
  });

  describe("useStartSession", () => {
    it("should call POST /trivia/session/start with NIP-98 auth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSession),
      });

      const { result } = renderHook(() => useStartSession(), {
        wrapper: createWrapper(),
      });

      let session;
      await act(async () => {
        session = await result.current.start(1);
      });

      expect(mockCreateNIP98AuthHeader).toHaveBeenCalledWith(
        expect.stringContaining("/trivia/session/start"),
        "POST"
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/trivia/session/start"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Nostr test-auth-header",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ level: 1 }),
        })
      );
      expect(session).toEqual(mockSession);
    });

    it("should throw TriviaApiError with status 429 on rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const { result } = renderHook(() => useStartSession(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.start(1);
        })
      ).rejects.toThrow("Rate limited");
    });
  });

  describe("useSubmitAnswer", () => {
    it("should call POST /trivia/session/answer with NIP-98 auth", async () => {
      const answerResponse = {
        correct: true,
        explanation: "Because reasons.",
        streak: 3,
        satsEarned: 10,
        levelUnlocked: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(answerResponse),
      });

      const { result } = renderHook(() => useSubmitAnswer(), {
        wrapper: createWrapper(),
      });

      let response;
      await act(async () => {
        response = await result.current.submit("session-123", 1, 0);
      });

      expect(mockCreateNIP98AuthHeader).toHaveBeenCalledWith(
        expect.stringContaining("/trivia/session/answer"),
        "POST"
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/trivia/session/answer"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sessionId: "session-123",
            questionId: 1,
            answer: 0,
          }),
        })
      );
      expect(response).toEqual(answerResponse);
    });

    it("should throw TriviaApiError on session expired (410)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: () => Promise.resolve({ error: "Session expired" }),
      });

      const { result } = renderHook(() => useSubmitAnswer(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.submit("session-123", 1, 0);
        })
      ).rejects.toThrow("Session expired");
    });

    it("should throw TriviaApiError on bad request (400)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid answer" }),
      });

      const { result } = renderHook(() => useSubmitAnswer(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.submit("session-123", 1, 5);
        })
      ).rejects.toThrow("Invalid answer");
    });
  });

  describe("useTriviaProgress", () => {
    it("should call GET /trivia/progress with NIP-98 auth", async () => {
      const progressData = {
        currentLevel: 2,
        questionsAnswered: 10,
        correct: 8,
        streak: 3,
        bestStreak: 5,
        satsEarned: 100,
        levelCompleted: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(progressData),
      });

      const { result } = renderHook(() => useTriviaProgress(), {
        wrapper: createWrapper(),
      });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual(progressData);
      });

      expect(mockCreateNIP98AuthHeader).toHaveBeenCalledWith(
        expect.stringContaining("/trivia/progress"),
        "GET"
      );
    });
  });

  describe("TriviaApiError", () => {
    it("should have status property", () => {
      const err = new TriviaApiError("test", 429);
      expect(err.status).toBe(429);
      expect(err.message).toBe("test");
      expect(err.name).toBe("TriviaApiError");
    });
  });
});
