import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@nostrify/react", () => ({
  useNostr: vi.fn(() => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  })),
}));

vi.mock("@nostrify/react/login", () => ({
  useNostrLogin: vi.fn(() => ({
    logins: [],
    addLogin: vi.fn(),
    removeLogin: vi.fn(),
  })),
  NUser: {
    fromNsecLogin: vi.fn(),
    fromBunkerLogin: vi.fn(),
    fromExtensionLogin: vi.fn(),
  },
}));

import { useCurrentUser } from "../useCurrentUser";

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

describe("useCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be exported from the module", () => {
    expect(useCurrentUser).toBeDefined();
    expect(typeof useCurrentUser).toBe("function");
  });

  it("should return undefined user when no logins exist", () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.users).toEqual([]);
  });

  it("should return user and users properties", () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("users");
  });
});
