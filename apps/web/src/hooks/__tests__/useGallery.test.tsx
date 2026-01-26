import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useGallery } from "../useGallery";

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

const mockGalleryItem = {
  url: "https://nostr.build/image/abc123.jpg",
  type: "image/jpeg",
  uploaded: 1706000000,
};

describe("useGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should be exported from the module", () => {
    expect(useGallery).toBeDefined();
    expect(typeof useGallery).toBe("function");
  });

  it("should return gallery state and actions", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("images");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("refresh");
  });

  it("should fetch gallery images on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockGalleryItem]),
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].url).toBe("https://nostr.build/image/abc123.jpg");
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it("should provide refresh function", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refresh).toBe("function");
  });

  it("should handle empty gallery", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("should handle API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it("should fetch multiple images", async () => {
    const multipleImages = [
      { url: "https://nostr.build/image/1.jpg", type: "image/jpeg", uploaded: 1706000001 },
      { url: "https://nostr.build/image/2.jpg", type: "image/jpeg", uploaded: 1706000002 },
      { url: "https://nostr.build/image/3.jpg", type: "image/jpeg", uploaded: 1706000003 },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(multipleImages),
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toHaveLength(3);
  });
});
