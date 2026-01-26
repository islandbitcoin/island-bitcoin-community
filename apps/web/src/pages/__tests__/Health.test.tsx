import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
  })),
}));

import Health from "../Health";

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Health Page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  it("should render health check heading", () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    const healthElements = screen.getAllByText(/health/i);
    expect(healthElements.length).toBeGreaterThan(0);
  });

  it("should display system health status", () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    expect(screen.getByText(/system health/i)).toBeInTheDocument();
  });

  it("should show application check", async () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/application/i)).toBeInTheDocument();
    });
  });

  it("should show local storage check", async () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/local storage/i)).toBeInTheDocument();
    });
  });

  it("should have back link", () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    expect(screen.getByRole("link", { name: /back/i })).toBeInTheDocument();
  });

  it("should show overall status badge", async () => {
    render(
      <TestWrapper>
        <Health />
      </TestWrapper>
    );

    await waitFor(() => {
      const badges = screen.getAllByText(/healthy|warning|unhealthy|checking/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
