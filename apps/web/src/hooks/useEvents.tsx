import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventoEmbedEvent } from "@/types/events";

const EMBED_BASE = "https://evento.so/api/embed/v1";
const USERNAME = "islandbitcoin";

export type EventFilter = "all" | "upcoming" | "past";

/** Resolve cover image URLs — API returns relative paths like /eventos/uploaded-covers/... */
function resolveCoverUrl(cover: string | null): string | null {
  if (!cover) return null;
  if (cover.startsWith("http")) return cover;
  return `https://api.evento.so/storage/v1/render/image/public/cdn${cover}`;
}

function normalizeEvent(event: EventoEmbedEvent): EventoEmbedEvent {
  return {
    ...event,
    cover: resolveCoverUrl(event.cover),
  };
}

async function fetchEventoEvents(): Promise<EventoEmbedEvent[]> {
  const res = await fetch(`${EMBED_BASE}/users/${USERNAME}/events?limit=100`);
  if (!res.ok) throw new Error(`Evento API error: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []).map(normalizeEvent);
}

function filterAndSort(
  events: EventoEmbedEvent[],
  filter: EventFilter
): EventoEmbedEvent[] {
  const filtered = events.filter((e) => {
    if (filter === "upcoming") return e.status === "upcoming" || e.status === "ongoing";
    if (filter === "past") return e.status === "past";
    return true;
  });

  return filtered.sort((a, b) => {
    // upcoming/ongoing before past
    if (a.status !== "past" && b.status === "past") return -1;
    if (a.status === "past" && b.status !== "past") return 1;

    const aDate = new Date(a.start_date).getTime();
    const bDate = new Date(b.start_date).getTime();

    // upcoming: soonest first; past: most recent first
    if (a.status !== "past") return aDate - bDate;
    return bDate - aDate;
  });
}

export function useEvents(filter: EventFilter = "all") {
  const queryClient = useQueryClient();

  const {
    data: rawEvents,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["evento-events"],
    queryFn: fetchEventoEvents,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const events = rawEvents ? filterAndSort(rawEvents, filter) : [];

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["evento-events"] });
  }, [queryClient]);

  return {
    events,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}

// Helper functions for components
export function formatEventDate(
  startDate: string,
  timezone?: string
): string {
  try {
    return new Date(startDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: timezone || undefined,
    });
  } catch {
    return "Date TBD";
  }
}

export function formatEventTime(
  startDate: string,
  endDate: string | null,
  timezone?: string
): string {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    };
    const start = new Date(startDate).toLocaleTimeString("en-US", opts);
    if (!endDate) return start;
    const end = new Date(endDate).toLocaleTimeString("en-US", opts);
    return `${start} – ${end}`;
  } catch {
    return "";
  }
}

export function formatLocation(
  location: EventoEmbedEvent["location"]
): string {
  if (!location) return "Location TBD";
  const parts = [location.name, location.city, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location TBD";
}

export function getEventoUrl(eventId: string): string {
  return `https://evento.so/e/${eventId}`;
}
