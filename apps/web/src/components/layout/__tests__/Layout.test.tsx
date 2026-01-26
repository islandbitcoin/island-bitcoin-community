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

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(() => ({
    user: null,
    metadata: null,
  })),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
  })),
}));

vi.mock("@/hooks/useNostrFeed", () => ({
  useNostrFeed: vi.fn(() => ({
    posts: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/hooks/useAuthor", () => ({
  useAuthor: vi.fn(() => ({
    data: null,
    isLoading: false,
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

import { Layout } from "../Layout";
import { Header } from "../Header";
import { Footer } from "../Footer";

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Layout", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  it("should render children content", () => {
    render(
      <TestWrapper>
        <Layout>
          <div data-testid="test-content">Test Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  it("should include Header component", () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should include Footer component", () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("should have proper layout structure", () => {
    render(
      <TestWrapper>
        <Layout>
          <div>Content</div>
        </Layout>
      </TestWrapper>
    );

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
  });
});

describe("Header", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  });

  it("should render the header", () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should have navigation links", () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    const homeLinks = screen.getAllByRole("link", { name: /home/i });
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it("should have login button when not authenticated", () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("should have theme toggle button", () => {
    render(
      <TestWrapper>
        <Header />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("should render the footer", () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("should have about link", () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>
    );

    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
  });

  it("should have copyright text", () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>
    );

    expect(screen.getByText(/Island Bitcoin/i)).toBeInTheDocument();
  });
});
