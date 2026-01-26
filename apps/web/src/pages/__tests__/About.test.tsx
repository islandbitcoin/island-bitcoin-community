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

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
  })),
}));

import About from "../About";

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("About Page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  it("should render the about heading", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    const aboutElements = screen.getAllByText(/about/i);
    expect(aboutElements.length).toBeGreaterThan(0);
  });

  it("should have back to home link", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();
  });

  it("should display mission section", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    const missionElements = screen.getAllByText(/mission/i);
    expect(missionElements.length).toBeGreaterThan(0);
  });

  it("should display community information", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    const communityElements = screen.getAllByText(/community/i);
    expect(communityElements.length).toBeGreaterThan(0);
  });

  it("should have features section", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    const securityElements = screen.getAllByText(/security/i);
    expect(securityElements.length).toBeGreaterThan(0);
  });

  it("should have footer", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("should have open source section", () => {
    render(
      <TestWrapper>
        <About />
      </TestWrapper>
    );

    const openSourceElements = screen.getAllByText(/open source/i);
    expect(openSourceElements.length).toBeGreaterThan(0);
  });
});
