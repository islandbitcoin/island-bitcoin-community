import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = { pubkey: "new-admin-pubkey-456" };
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: mockUser,
  })),
}));

import AdminSetup from "../AdminSetup";

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

describe("AdminSetup Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockNavigate.mockReset();
  });

  it("should render the setup page title", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]" }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /admin setup/i })).toBeInTheDocument();
    });
  });

  it("should display user pubkey", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]" }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/new-admin-pubkey-456/i)).toBeInTheDocument();
    });
  });

  it("should show claim admin button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]" }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /claim admin access/i })).toBeInTheDocument();
    });
  });

  it("should show admin responsibilities list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]" }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/admin responsibilities/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/configure game rewards/i)).toBeInTheDocument();
  });

  it("should show already configured message when admin exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: JSON.stringify(["other-admin-pubkey"]) }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/admin already configured/i)).toBeInTheDocument();
    });
  });

  it("should show return home link when admin already configured", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: JSON.stringify(["other-admin-pubkey"]) }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /return home/i })).toBeInTheDocument();
    });
  });

  it("should show setup complete message after claiming", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]", success: true }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /claim admin access/i })).toBeInTheDocument();
    });

    const claimButton = screen.getByRole("button", { name: /claim admin access/i });
    await user.click(claimButton);

    await waitFor(() => {
      expect(screen.getByText(/setup complete/i)).toBeInTheDocument();
    });
  });

  it("should show important warning about first admin", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ adminPubkeys: "[]" }),
    });

    const Wrapper = createWrapper();
    render(<AdminSetup />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/important/i)).toBeInTheDocument();
    });
  });
});
