import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === "(prefers-color-scheme: dark)" ? false : false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: null,
    metadata: null,
  })),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
  })),
}));

vi.mock("@/hooks/useGameWallet", () => ({
  useGameWallet: vi.fn(() => ({
    balance: { balance: 0, pendingBalance: 0 },
    isLoading: false,
    refreshBalance: vi.fn(),
  })),
}));

vi.mock("@/hooks/useTriviaQuestions", () => ({
  useStartSession: vi.fn(() => ({
    start: vi.fn(),
    isAuthenticated: false,
  })),
  useSubmitAnswer: vi.fn(() => ({
    submit: vi.fn(),
    isAuthenticated: false,
  })),
  useTriviaProgress: vi.fn(() => ({
    data: null,
    refetch: vi.fn(),
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

vi.mock("@/hooks/useNostrFeed", () => ({
  useNostrFeed: vi.fn(() => ({
    posts: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/hooks/useAuthor", () => ({
  useAuthor: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
}));

import Index from "../Index";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
};

describe("Index Page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  it("should render the main heading", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("should have header with navigation", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should have footer", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("should display community tagline", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    const bitcoinElements = screen.getAllByText(/Bitcoin/i);
    expect(bitcoinElements.length).toBeGreaterThan(0);
  });

  it("should have join community button", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
  });

  it("should have events section", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    const eventsElements = screen.getAllByText(/events/i);
    expect(eventsElements.length).toBeGreaterThan(0);
  });

  it("should have games section", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <Index />
      </Wrapper>
    );

    const triviaElements = screen.getAllByText(/trivia/i);
    expect(triviaElements.length).toBeGreaterThan(0);
  });
});
