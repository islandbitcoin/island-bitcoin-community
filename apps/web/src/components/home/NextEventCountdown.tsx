import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarPlus, MapPin, ExternalLink } from "lucide-react";
import {
  useEvents,
  formatEventDate,
  formatEventTime,
  formatLocation,
  getEventoUrl,
} from "@/hooks/useEvents";
import type { EventoEmbedEvent } from "@/types/events";
import { Link } from "react-router-dom";

const LIVE_GRACE_MS = 3 * 60 * 60 * 1000; // treat no-end-date events as ~3h

function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

function isLiveNow(event: EventoEmbedEvent, now: number): boolean {
  const start = new Date(event.start_date).getTime();
  const end = event.end_date
    ? new Date(event.end_date).getTime()
    : start + LIVE_GRACE_MS;
  return now >= start && now <= end;
}

function splitCountdown(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function googleCalendarUrl(event: EventoEmbedEvent): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = fmt(event.start_date);
  const end = event.end_date
    ? fmt(event.end_date)
    : fmt(new Date(new Date(event.start_date).getTime() + LIVE_GRACE_MS).toISOString());
  const location = event.location
    ? [event.location.name, event.location.city, event.location.country]
        .filter(Boolean)
        .join(", ")
    : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: `RSVP and details: ${getEventoUrl(event.id)}`,
    ...(location ? { location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function NextEventCountdown() {
  const { events, isLoading } = useEvents("upcoming");
  const now = useNow();

  const next = events[0] ?? null;

  const live = useMemo(
    () => (next ? isLiveNow(next, now) : false),
    [next, now]
  );

  if (isLoading) return null;

  if (!next) {
    // No events published right now — point people at the events page.
    return (
      <div className="mt-10 max-w-md mx-auto">
        <Link
          to="/events"
          className="block rounded-2xl border border-primary/25 bg-card/60 backdrop-blur px-6 py-4 text-sm text-muted-foreground hover:border-primary/50 transition-colors"
        >
          <span className="font-medium text-foreground">Meetups in Kingston and across the islands.</span>{" "}
          <span className="whitespace-nowrap">See what&#39;s on&nbsp;→</span>
        </Link>
      </div>
    );
  }

  const msLeft = new Date(next.start_date).getTime() - now;
  const { days, hours, minutes, seconds } = splitCountdown(msLeft);

  return (
    <div className="mt-10 max-w-xl mx-auto">
      <div className="rounded-2xl border border-primary/25 bg-card/60 backdrop-blur overflow-hidden shadow-lg shadow-primary/5">
        <div className="px-6 py-5">
          <div className="flex items-center justify-center gap-2 mb-3">
            {live ? (
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-600">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                Live right now
              </span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Next up
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-semibold text-foreground leading-snug mb-2">
            {next.title}
          </h3>

          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatEventDate(next.start_date, next.timezone)} ·{" "}
            {formatEventTime(next.start_date, next.end_date, next.timezone)}
          </p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {formatLocation(next.location)}
          </p>

          {!live && (
            <div className="flex justify-center gap-3 mt-4" aria-label="Time until event">
              {[
                { value: days, label: "days" },
                { value: hours, label: "hrs" },
                { value: minutes, label: "min" },
                { value: seconds, label: "sec" },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div className="min-w-14 rounded-lg bg-primary/10 border border-primary/15 px-2 py-1.5">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {String(unit.value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-4">
            <a
              href={getEventoUrl(next.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {live ? "Join us" : "RSVP free"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {!live && (
              <a
                href={googleCalendarUrl(next)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <CalendarPlus className="h-4 w-4" />
                Add to calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
