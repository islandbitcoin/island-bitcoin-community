import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockReq = vi.fn();

vi.mock("@nostrify/react", () => ({
  useNostr: () => ({
    nostr: {
      req: mockReq,
    },
  }),
}));

const mockUser = {
  pubkey: "user123pubkey",
};

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: mockUser,
  }),
}));

import { useNotifications } from "../useNotifications";

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

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReq.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield ["EOSE"];
      },
    });
  });

  it("should be exported from the module", () => {
    expect(useNotifications).toBeDefined();
    expect(typeof useNotifications).toBe("function");
  });

  it("should return notifications array", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.notifications).toBeDefined();
    expect(Array.isArray(result.current.notifications)).toBe(true);
  });

  it("should return unreadCount", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.unreadCount).toBe("number");
  });

  it("should provide markAsRead function", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.markAsRead).toBe("function");
  });

  it("should provide markAllAsRead function", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.markAllAsRead).toBe("function");
  });

  it("should provide clearAll function", () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.clearAll).toBe("function");
  });

  it("should start listening for notifications when user is present", async () => {
    renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockReq).toHaveBeenCalled();
    });
  });
});
