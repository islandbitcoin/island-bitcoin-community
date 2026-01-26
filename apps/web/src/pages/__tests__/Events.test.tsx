import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Events from "../Events";

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

const mockEvent = {
  event: {
    id: "test-event-1",
    status: "active",
    basic_info: {
      title: "Bitcoin Meetup",
      description: "Monthly Bitcoin meetup",
      summary: "Join us for Bitcoin discussions",
      type: "meetup",
      tags: ["bitcoin", "meetup"],
    },
    datetime: {
      start: "2027-02-15T18:00:00Z",
      end: "2027-02-15T21:00:00Z",
    },
    location: {
      type: "physical",
      name: "Bitcoin Beach",
      address: {
        city: "San Juan",
        country: "Puerto Rico",
      },
    },
    organizer: {
      name: "Island Bitcoin",
    },
  },
};

describe("Events Page", () => {
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
    render(<Events />, { wrapper: Wrapper });

    expect(screen.getByRole("heading", { name: /bitcoin events/i })).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("should display events when loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockEvent]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Bitcoin Meetup")).toBeInTheDocument();
    });
  });

  it("should show empty state when no events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no events found/i)).toBeInTheDocument();
    });
  });

  it("should show error state on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/unable to load events/i)).toBeInTheDocument();
    });
  });

  it("should have filter buttons", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    expect(screen.getByRole("button", { name: /all events/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /past events/i })).toBeInTheDocument();
  });

  it("should have refresh button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("should have back to home link", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    expect(screen.getByRole("link", { name: /back to home/i })).toBeInTheDocument();
  });

  it("should filter events when clicking filter buttons", async () => {
    const user = userEvent.setup();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockEvent]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Bitcoin Meetup")).toBeInTheDocument();
    });

    const upcomingButton = screen.getByRole("button", { name: /upcoming/i });
    await user.click(upcomingButton);

    expect(upcomingButton).toHaveAttribute("data-state", "active");
  });

  it("should display event location", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockEvent]),
    });

    const Wrapper = createWrapper();
    render(<Events />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/san juan, puerto rico/i)).toBeInTheDocument();
    });
  });
});
