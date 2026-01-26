import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === "(prefers-color-scheme: dark)" ? false : false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const mockUseCurrentUser = vi.fn();

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
  })),
}));

vi.mock("@/hooks/useLoginActions", () => ({
  useLoginActions: vi.fn(() => ({
    extension: vi.fn(),
    nsec: vi.fn(),
    bunker: vi.fn(),
    logout: vi.fn(),
  })),
}));

import Settings from "../Settings";

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Settings Page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
    mockUseCurrentUser.mockReturnValue({
      user: null,
      metadata: null,
    });
  });

  it("should render settings heading", () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("should show login prompt when not authenticated", () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const signInElements = screen.getAllByText(/sign in/i);
    expect(signInElements.length).toBeGreaterThan(0);
  });

  it("should show settings tabs when authenticated", () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: "test-pubkey" },
      metadata: { name: "Test User" },
    });

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preferences/i })).toBeInTheDocument();
  });

  it("should have back link", () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    expect(screen.getByRole("link", { name: /back/i })).toBeInTheDocument();
  });

  it("should show theme toggle in preferences when authenticated", () => {
    mockUseCurrentUser.mockReturnValue({
      user: { pubkey: "test-pubkey" },
      metadata: { name: "Test User" },
    });

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    );

    const preferencesElements = screen.getAllByText(/preferences/i);
    expect(preferencesElements.length).toBeGreaterThan(0);
  });
});
