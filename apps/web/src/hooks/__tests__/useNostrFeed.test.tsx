import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockQuery = vi.fn();

vi.mock("@nostrify/react", () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
    },
  }),
}));

import { useNostrFeed } from "../useNostrFeed";

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

const mockPosts = [
  {
    id: "event1",
    pubkey: "pubkey1",
    kind: 1,
    content: "Hello Nostr!",
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    sig: "sig1",
  },
  {
    id: "event2",
    pubkey: "pubkey2",
    kind: 1,
    content: "Bitcoin is freedom",
    created_at: Math.floor(Date.now() / 1000) - 60,
    tags: [],
    sig: "sig2",
  },
];

describe("useNostrFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(mockPosts);
  });

  it("should be exported from the module", () => {
    expect(useNostrFeed).toBeDefined();
    expect(typeof useNostrFeed).toBe("function");
  });

  it("should return posts from nostr query", async () => {
    const { result } = renderHook(() => useNostrFeed({ limit: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.posts.length).toBeGreaterThan(0);
    });

    expect(result.current.posts[0].content).toBe("Hello Nostr!");
  });

  it("should return loading state initially", () => {
    mockQuery.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useNostrFeed({ limit: 20 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should query for kind 1 events", async () => {
    const { result } = renderHook(() => useNostrFeed({ limit: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      [expect.objectContaining({ kinds: [1] })],
      expect.any(Object)
    );
  });

  it("should respect the limit parameter", async () => {
    const { result } = renderHook(() => useNostrFeed({ limit: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      [expect.objectContaining({ limit: 10 })],
      expect.any(Object)
    );
  });

  it("should sort posts by created_at descending", async () => {
    const unsortedPosts = [
      { ...mockPosts[1], id: "old", created_at: 1000 },
      { ...mockPosts[0], id: "new", created_at: 2000 },
    ];
    mockQuery.mockResolvedValue(unsortedPosts);

    const { result } = renderHook(() => useNostrFeed({ limit: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.posts.length).toBe(2);
    });

    expect(result.current.posts[0].created_at).toBeGreaterThan(
      result.current.posts[1].created_at
    );
  });

  it("should handle empty results", async () => {
    mockQuery.mockResolvedValue([]);

    const { result } = renderHook(() => useNostrFeed({ limit: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toEqual([]);
  });
});
