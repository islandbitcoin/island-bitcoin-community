import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/hooks/useAuthor", () => ({
  useAuthor: (pubkey: string) => ({
    data: {
      metadata: {
        name: `User-${pubkey.slice(0, 8)}`,
        picture: `https://example.com/${pubkey}.jpg`,
      },
    },
    isLoading: false,
  }),
}));

import { NostrFeed } from "../NostrFeed";

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

describe("NostrFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(mockPosts);
  });

  it("should render the feed title", async () => {
    render(<NostrFeed />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Feed");
  });

  it("should display posts from nostr", async () => {
    render(<NostrFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Hello Nostr!")).toBeInTheDocument();
    });

    expect(screen.getByText("Bitcoin is freedom")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    mockQuery.mockImplementation(() => new Promise(() => {}));
    render(<NostrFeed />, { wrapper: createWrapper() });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should show empty state when no posts", async () => {
    mockQuery.mockResolvedValue([]);
    render(<NostrFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no posts/i)).toBeInTheDocument();
    });
  });

  it("should display author names", async () => {
    render(<NostrFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Hello Nostr!")).toBeInTheDocument();
    });

    expect(screen.getByText(/User-pubkey1/)).toBeInTheDocument();
  });

  it("should display relative timestamps", async () => {
    render(<NostrFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Hello Nostr!")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/just now|ago/i).length).toBeGreaterThan(0);
  });
});
