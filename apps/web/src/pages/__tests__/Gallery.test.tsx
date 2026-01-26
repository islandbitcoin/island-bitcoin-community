import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Gallery from "../Gallery";

const mockFetch = vi.fn();
global.fetch = mockFetch;

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

const mockGalleryImages = [
  { url: "https://nostr.build/image/1.jpg", type: "image/jpeg", uploaded: 1706000001 },
  { url: "https://nostr.build/image/2.jpg", type: "image/jpeg", uploaded: 1706000002 },
  { url: "https://nostr.build/image/3.jpg", type: "image/jpeg", uploaded: 1706000003 },
];

describe("Gallery Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should render the page title", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    expect(screen.getByRole("heading", { name: /community gallery/i })).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("should display images when loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGalleryImages),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it("should show empty state when no images", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no images found/i)).toBeInTheDocument();
    });
  });

  it("should show error state on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/unable to load gallery/i)).toBeInTheDocument();
    });
  });

  it("should have refresh button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("should have back to home link", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();
  });

  it("should display images in a grid", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGalleryImages),
    });

    const Wrapper = createWrapper();
    render(<Gallery />, { wrapper: Wrapper });

    await waitFor(() => {
      const grid = screen.getByTestId("gallery-grid");
      expect(grid).toBeInTheDocument();
    });
  });
});
