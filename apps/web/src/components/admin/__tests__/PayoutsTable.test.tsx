import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: { pubkey: "test-pubkey-123" },
  })),
}));

import { PayoutsTable } from "../PayoutsTable";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
};

const mockPayouts = [
  {
    id: "payout-1",
    userPubkey: "user-pubkey-123",
    amount: 100,
    gameType: "trivia",
    status: "paid",
    timestamp: "2026-01-25T10:00:00Z",
  },
  {
    id: "payout-2",
    userPubkey: "user-pubkey-456",
    amount: 50,
    gameType: "stacker",
    status: "pending",
    timestamp: "2026-01-25T11:00:00Z",
  },
  {
    id: "payout-3",
    userPubkey: "user-pubkey-789",
    amount: 200,
    gameType: "withdrawal",
    status: "paid",
    timestamp: "2026-01-25T12:00:00Z",
    pullPaymentId: "pullpayment_abc123",
  },
];

describe("PayoutsTable Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should show total payouts summary when data loads", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ payouts: mockPayouts, pagination: { total: 3 } }),
    });

    const Wrapper = createWrapper();
    render(<PayoutsTable />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/total payouts: 3/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/350 sats/i)).toBeInTheDocument();
  });

  it("should show empty state when no payouts", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ payouts: [], pagination: { total: 0 } }),
    });

    const Wrapper = createWrapper();
    render(<PayoutsTable />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no payouts recorded/i)).toBeInTheDocument();
    });
  });

  it("should show loading state", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createWrapper();
    render(<PayoutsTable />, { wrapper: Wrapper });

    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("should display status badges", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ payouts: mockPayouts, pagination: { total: 3 } }),
    });

    const Wrapper = createWrapper();
    render(<PayoutsTable />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/total payouts: 3/i)).toBeInTheDocument();
    });

    const completedBadges = screen.getAllByText(/completed/i);
    expect(completedBadges.length).toBeGreaterThan(0);
  });

  it("should call fetch with correct parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ payouts: mockPayouts, pagination: { total: 3 } }),
    });

    const Wrapper = createWrapper();
    render(<PayoutsTable />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/wallet/payouts"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Nostr"),
          }),
        })
      );
    });
  });
});
