import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@nostrify/react", () => ({
  useNostr: vi.fn(() => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  })),
}));

vi.mock("@/hooks/useAuthor", () => ({
  useAuthor: vi.fn((pubkey: string) => ({
    data: {
      metadata: {
        name: `User-${pubkey.slice(0, 8)}`,
        picture: `https://example.com/${pubkey}.jpg`,
      },
    },
    isLoading: false,
  })),
}));

import { Leaderboard } from "../Leaderboard";

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

const mockLeaderboardData = [
  { pubkey: "pubkey1", score: 10000, gameCount: 50 },
  { pubkey: "pubkey2", score: 8500, gameCount: 42 },
  { pubkey: "pubkey3", score: 7200, gameCount: 35 },
];

describe("Leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaderboardData),
    });
  });

  it("should render the leaderboard title", async () => {
    render(<Leaderboard />, { wrapper: createWrapper() });

    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
  });

  it("should render timeframe tabs", async () => {
    render(<Leaderboard />, { wrapper: createWrapper() });

    expect(screen.getByRole("tab", { name: /daily/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /weekly/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /all time/i })).toBeInTheDocument();
  });

  it("should fetch leaderboard data on mount", async () => {
    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/leaderboard")
      );
    });
  });

  it("should display leaderboard entries", async () => {
    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("10,000")).toBeInTheDocument();
    });

    expect(screen.getByText("50 games played")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<Leaderboard />, { wrapper: createWrapper() });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should show empty state when no data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no games played/i)).toBeInTheDocument();
    });
  });

  it("should switch timeframes when tabs are clicked", async () => {
    const user = userEvent.setup();
    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    mockFetch.mockClear();

    const weeklyTab = screen.getByRole("tab", { name: /weekly/i });
    await user.click(weeklyTab);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("timeframe=weekly")
      );
    });
  });

  it("should display rank icons for top 3", async () => {
    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("10,000")).toBeInTheDocument();
    });

    const trophyIcons = document.querySelectorAll('[data-testid="rank-icon"]');
    expect(trophyIcons.length).toBeGreaterThanOrEqual(3);
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<Leaderboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
