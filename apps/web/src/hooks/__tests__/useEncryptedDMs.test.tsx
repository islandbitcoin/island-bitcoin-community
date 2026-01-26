import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockQuery = vi.fn();
const mockEvent = vi.fn();
const mockReq = vi.fn();
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();

vi.mock("@nostrify/react", () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
      event: mockEvent,
      req: mockReq,
    },
  }),
}));

const mockUser = {
  pubkey: "user123pubkey",
  signer: {
    nip04: {
      encrypt: mockEncrypt,
      decrypt: mockDecrypt,
    },
    signEvent: vi.fn((event) =>
      Promise.resolve({
        ...event,
        id: "signed-event-id",
        pubkey: "user123pubkey",
        sig: "signature",
      })
    ),
  },
};

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: mockUser,
  }),
}));

import { useEncryptedDMs } from "../useEncryptedDMs";

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

const mockDMEvents = [
  {
    id: "dm1",
    pubkey: "other123pubkey",
    kind: 4,
    content: "encrypted-content-1",
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", "user123pubkey"]],
    sig: "sig1",
  },
  {
    id: "dm2",
    pubkey: "user123pubkey",
    kind: 4,
    content: "encrypted-content-2",
    created_at: Math.floor(Date.now() / 1000) - 60,
    tags: [["p", "other123pubkey"]],
    sig: "sig2",
  },
];

describe("useEncryptedDMs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(mockDMEvents);
    mockDecrypt.mockResolvedValue("Decrypted message");
    mockEncrypt.mockResolvedValue("encrypted-content");
    mockEvent.mockResolvedValue(undefined);
    mockReq.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield ["EOSE"];
      },
    });
  });

  it("should be exported from the module", () => {
    expect(useEncryptedDMs).toBeDefined();
    expect(typeof useEncryptedDMs).toBe("function");
  });

  it("should return conversations array", async () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.conversations).toBeDefined();
    expect(Array.isArray(result.current.conversations)).toBe(true);
  });

  it("should return loading state", () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("should provide sendDM function", () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.sendDM).toBe("function");
  });

  it("should provide markAsRead function", () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.markAsRead).toBe("function");
  });

  it("should provide totalUnread count", () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.totalUnread).toBe("number");
  });

  it("should load DMs on mount", async () => {
    renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  it("should have sendDM that accepts recipient and content", () => {
    const { result } = renderHook(() => useEncryptedDMs(), {
      wrapper: createWrapper(),
    });

    expect(result.current.sendDM.length).toBe(2);
  });
});
