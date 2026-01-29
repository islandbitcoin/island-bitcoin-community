import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: { pubkey: "test-pubkey-123" },
  })),
}));

vi.mock("@/hooks/useGameWallet", () => ({
  useGameWallet: vi.fn(() => ({
    balance: { balance: 100, pendingBalance: 0 },
    isLoading: false,
    refreshBalance: vi.fn(),
  })),
}));

const mockStart = vi.fn();
const mockSubmit = vi.fn();
const mockRefetchProgress = vi.fn();

const mockSession = {
  sessionId: "test-session-1",
  questions: [
    {
      id: 1,
      question: "What is the maximum supply of Bitcoin?",
      options: ["21 million", "100 million", "1 billion", "Unlimited"],
      difficulty: "easy",
      category: "basics",
      level: 1,
    },
    {
      id: 2,
      question: "Who created Bitcoin?",
      options: ["Vitalik Buterin", "Satoshi Nakamoto", "Nick Szabo", "Hal Finney"],
      difficulty: "easy",
      category: "history",
      level: 1,
    },
  ],
  level: 1,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
};

const mockProgress = {
  currentLevel: 1,
  questionsAnswered: 5,
  correct: 3,
  streak: 2,
  bestStreak: 4,
  satsEarned: 50,
  levelCompleted: false,
};

vi.mock("@/hooks/useTriviaQuestions", () => ({
  useStartSession: vi.fn(() => ({
    start: mockStart,
    isAuthenticated: true,
  })),
  useSubmitAnswer: vi.fn(() => ({
    submit: mockSubmit,
    isAuthenticated: true,
  })),
  useTriviaProgress: vi.fn(() => ({
    data: mockProgress,
    refetch: mockRefetchProgress,
  })),
  TriviaApiError: class TriviaApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "TriviaApiError";
      this.status = status;
    }
  },
}));

import { BitcoinTrivia } from "../BitcoinTrivia";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("BitcoinTrivia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(mockSession);
    mockSubmit.mockResolvedValue({
      correct: true,
      explanation: "Bitcoin has a fixed supply of 21 million.",
      streak: 3,
      satsEarned: 10,
      levelUnlocked: false,
    });
  });

  it("should render the trivia component", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    expect(screen.getByText(/Bitcoin Trivia/i)).toBeInTheDocument();
  });

  it("should display level in title", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    expect(screen.getByText(/Bitcoin Trivia - Level 1/i)).toBeInTheDocument();
  });

  it("should auto-start a session and display question", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith(1);
    });

    const question = await screen.findByText(
      /maximum supply/i,
      {},
      { timeout: 3000 }
    );
    expect(question).toBeInTheDocument();
  });

  it("should display answer options", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(
      () => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(1);
      },
      { timeout: 3000 }
    );
  });

  it("should handle answer submission with explanation", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/maximum supply|Who created/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const answerButtons = screen.getAllByRole("button").filter(
      (btn) =>
        btn.textContent?.includes("million") ||
        btn.textContent?.includes("Satoshi")
    );

    if (answerButtons.length > 0) {
      await act(async () => {
        fireEvent.click(answerButtons[0]);
      });

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          "test-session-1",
          expect.any(Number),
          expect.any(Number)
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/fixed supply of 21 million/i)).toBeInTheDocument();
      });
    }
  });

  it("should show progress stats from server", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    expect(screen.getByText(/Questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should have level selector button", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    expect(
      screen.getByRole("button", { name: /Choose Different Level/i })
    ).toBeInTheDocument();
  });

  it("should show balance in header", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    expect(screen.getByText(/100 sats/i)).toBeInTheDocument();
  });

  it("should show session timer", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should handle session start rate limit (429)", async () => {
    const { TriviaApiError } = await import("@/hooks/useTriviaQuestions");
    mockStart.mockRejectedValueOnce(new TriviaApiError("Rate limited", 429));

    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Slow down/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should handle session expiry on answer submit", async () => {
    const { TriviaApiError } = await import("@/hooks/useTriviaQuestions");
    mockSubmit.mockRejectedValueOnce(
      new TriviaApiError("Session expired", 410)
    );

    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/maximum supply|Who created/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const answerButtons = screen.getAllByRole("button").filter(
      (btn) =>
        btn.textContent?.includes("million") ||
        btn.textContent?.includes("Satoshi")
    );

    if (answerButtons.length > 0) {
      await act(async () => {
        fireEvent.click(answerButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    }
  });
});
