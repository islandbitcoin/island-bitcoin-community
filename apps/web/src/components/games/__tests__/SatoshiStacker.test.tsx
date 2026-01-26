import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

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

import { SatoshiStacker } from "../SatoshiStacker";

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

describe("SatoshiStacker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("should render the stacker component", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText(/Satoshi Stacker/i)).toBeInTheDocument();
  });

  it("should display current sats balance", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText("0 sats")).toBeInTheDocument();
  });

  it("should have a stack sats button", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByRole("button", { name: /Stack Sats/i })).toBeInTheDocument();
  });

  it("should increment sats on click", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    const stackButton = screen.getByRole("button", { name: /Stack Sats/i });
    fireEvent.click(stackButton);

    expect(screen.getByText("1 sats")).toBeInTheDocument();
  });

  it("should display upgrades section", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText(/Upgrades/i)).toBeInTheDocument();
  });

  it("should show upgrade options", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText(/Better Mouse/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto Miner/i)).toBeInTheDocument();
  });

  it("should display BTC equivalent", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText(/0\.00000000 BTC/i)).toBeInTheDocument();
  });

  it("should show passive income rate in header", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText("0 sats/sec")).toBeInTheDocument();
  });

  it("should claim rewards via API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        satsEarned: 5,
        claimsRemaining: 9,
      }),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    const claimButton = screen.getByRole("button", { name: /Claim Reward/i });
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/stacker/claim"),
        expect.any(Object)
      );
    });
  });

  it("should show milestone progress", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <SatoshiStacker />
      </Wrapper>
    );

    expect(screen.getByText(/Next milestone/i)).toBeInTheDocument();
  });
});
