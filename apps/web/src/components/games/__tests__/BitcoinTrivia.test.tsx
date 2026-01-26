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

const mockSubmit = vi.fn();
const mockRefetch = vi.fn();

const mockQuestions = [
  {
    id: "l1-q1",
    question: "What is the maximum supply of Bitcoin?",
    options: ["21 million", "100 million", "1 billion", "Unlimited"],
    difficulty: "easy",
    category: "basics",
  },
  {
    id: "l1-q2",
    question: "Who created Bitcoin?",
    options: ["Vitalik Buterin", "Satoshi Nakamoto", "Nick Szabo", "Hal Finney"],
    difficulty: "easy",
    category: "history",
  },
];

vi.mock("@/hooks/useTriviaQuestions", () => ({
  useTriviaQuestions: vi.fn(() => ({
    data: {
      questions: mockQuestions,
      level: 1,
      progress: null,
    },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })),
  useSubmitAnswer: vi.fn(() => ({
    submit: mockSubmit,
    isAuthenticated: true,
  })),
}));

import { BitcoinTrivia } from "../BitcoinTrivia";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
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
    localStorage.clear();
    mockSubmit.mockResolvedValue({
      correct: true,
      streak: 1,
      satsEarned: 5,
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

  it("should display question when loaded", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    const question = await screen.findByText(/maximum supply|Who created/i, {}, { timeout: 3000 });
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

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(1);
    }, { timeout: 3000 });
  });

  it("should handle answer submission", async () => {
    const Wrapper = createWrapper();
    await act(async () => {
      render(
        <Wrapper>
          <BitcoinTrivia />
        </Wrapper>
      );
    });

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(1);
    }, { timeout: 3000 });

    const answerButtons = screen.getAllByRole("button").filter(
      btn => btn.textContent?.includes("million") || btn.textContent?.includes("Satoshi")
    );
    
    if (answerButtons.length > 0) {
      await act(async () => {
        fireEvent.click(answerButtons[0]);
      });

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
    }
  });

  it("should show progress stats", async () => {
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

    expect(screen.getByRole("button", { name: /Choose Different Level/i })).toBeInTheDocument();
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
});
