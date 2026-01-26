import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useCurrentUser
vi.mock("../useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: { pubkey: "test-pubkey-123" },
  })),
}));

import { useGameWallet } from "../useGameWallet";

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

describe("useGameWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should be exported from the module", () => {
    expect(useGameWallet).toBeDefined();
    expect(typeof useGameWallet).toBe("function");
  });

  it("should return balance state and actions", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        balance: 100,
        pendingBalance: 0,
        totalEarned: 500,
        totalWithdrawn: 400,
      }),
    });

    const { result } = renderHook(() => useGameWallet(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("balance");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("refreshBalance");
  });

  it("should fetch balance on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        balance: 250,
        pendingBalance: 50,
        totalEarned: 1000,
        totalWithdrawn: 700,
      }),
    });

    const { result } = renderHook(() => useGameWallet(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance?.balance).toBe(250);
    expect(result.current.balance?.pendingBalance).toBe(50);
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useGameWallet(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it("should provide refreshBalance function", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ balance: 0 }),
    });

    const { result } = renderHook(() => useGameWallet(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refreshBalance).toBe("function");
  });
});
