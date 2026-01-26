import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Event, EventWithDate } from "@/types/events";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export type EventFilter = "all" | "upcoming" | "past";

async function fetchEvents(): Promise<Event[]> {
  const response = await fetch(`${API_BASE}/events`);

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  return response.json();
}

function getNextOccurrence(event: Event): Date | null {
  const startDate = new Date(event.event.datetime.start);
  const now = new Date();

  if (event.event.datetime.recurring?.enabled) {
    const frequency = event.event.datetime.recurring.frequency;
    let nextDate = new Date(startDate);

    while (nextDate < now) {
      switch (frequency) {
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "biweekly":
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        default:
          return null;
      }
    }

    const endDate = event.event.datetime.recurring.end_date
      ? new Date(event.event.datetime.recurring.end_date)
      : null;

    if (endDate && nextDate > endDate) {
      return null;
    }

    return nextDate;
  }

  return startDate > now ? startDate : null;
}

function processEvents(events: Event[], filter: EventFilter): EventWithDate[] {
  const processed: EventWithDate[] = events.map((event) => ({
    event,
    nextDate: getNextOccurrence(event),
  }));

  const filtered = processed.filter((item) => {
    if (filter === "upcoming") return item.nextDate !== null;
    if (filter === "past") return item.nextDate === null;
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.nextDate && b.nextDate) {
      return a.nextDate.getTime() - b.nextDate.getTime();
    }
    if (a.nextDate && !b.nextDate) return -1;
    if (!a.nextDate && b.nextDate) return 1;

    const aDate = new Date(a.event.event.datetime.start);
    const bDate = new Date(b.event.event.datetime.start);
    return bDate.getTime() - aDate.getTime();
  });
}

export function useEvents(filter: EventFilter = "all") {
  const queryClient = useQueryClient();

  const {
    data: rawEvents,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const events = rawEvents ? processEvents(rawEvents, filter) : [];

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }, [queryClient]);

  return {
    events,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}
