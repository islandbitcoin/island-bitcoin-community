import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useEvents } from "../useEvents";

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
      start: "2026-02-15T18:00:00Z",
      end: "2026-02-15T21:00:00Z",
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

describe("useEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("should be exported from the module", () => {
    expect(useEvents).toBeDefined();
    expect(typeof useEvents).toBe("function");
  });

  it("should return events state and actions", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useEvents(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("events");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("refresh");
  });

  it("should fetch events on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockEvent]),
    });

    const { result } = renderHook(() => useEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].event.event.basic_info.title).toBe("Bitcoin Meetup");
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useEvents(), {
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

    const { result } = renderHook(() => useEvents(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refresh).toBe("function");
  });

  it("should filter upcoming events", async () => {
    const pastEvent = {
      event: {
        ...mockEvent.event,
        id: "past-event",
        datetime: {
          start: "2024-01-01T18:00:00Z",
          end: "2024-01-01T21:00:00Z",
        },
      },
    };

    const futureEvent = {
      event: {
        ...mockEvent.event,
        id: "future-event",
        datetime: {
          start: "2027-01-01T18:00:00Z",
          end: "2027-01-01T21:00:00Z",
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([pastEvent, futureEvent]),
    });

    const { result } = renderHook(() => useEvents("upcoming"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events.every(e => e.nextDate !== null)).toBe(true);
  });

  it("should filter past events", async () => {
    const pastEvent = {
      event: {
        ...mockEvent.event,
        id: "past-event",
        datetime: {
          start: "2024-01-01T18:00:00Z",
          end: "2024-01-01T21:00:00Z",
        },
      },
    };

    const futureEvent = {
      event: {
        ...mockEvent.event,
        id: "future-event",
        datetime: {
          start: "2027-01-01T18:00:00Z",
          end: "2027-01-01T21:00:00Z",
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([pastEvent, futureEvent]),
    });

    const { result } = renderHook(() => useEvents("past"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events.every(e => e.nextDate === null)).toBe(true);
  });

  it("should return all events when filter is 'all'", async () => {
    const pastEvent = {
      event: {
        ...mockEvent.event,
        id: "past-event",
        datetime: {
          start: "2024-01-01T18:00:00Z",
          end: "2024-01-01T21:00:00Z",
        },
      },
    };

    const futureEvent = {
      event: {
        ...mockEvent.event,
        id: "future-event",
        datetime: {
          start: "2027-01-01T18:00:00Z",
          end: "2027-01-01T21:00:00Z",
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([pastEvent, futureEvent]),
    });

    const { result } = renderHook(() => useEvents("all"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toHaveLength(2);
  });

  it("should handle empty events array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("should handle API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });
});
