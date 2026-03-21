import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  MapPin,
  Clock,
  Eye,
  ExternalLink,
} from "lucide-react";
import {
  useEvents,
  formatEventDate,
  formatEventTime,
  formatLocation,
  getEventoUrl,
  type EventFilter,
} from "@/hooks/useEvents";
import type { EventoEmbedEvent } from "@/types/events";
import { cn } from "@/lib/utils";

function EventCard({
  event,
  onViewDetails,
}: {
  event: EventoEmbedEvent;
  onViewDetails: (event: EventoEmbedEvent) => void;
}) {
  const isPast = event.status === "past";
  const locationStr = formatLocation(event.location);
  const eventoUrl = getEventoUrl(event.id);

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 flex flex-col h-full",
        isPast && "opacity-60 hover:opacity-80"
      )}
    >
      {/* Cover image */}
      {event.cover && (
        <div className="relative w-full h-40 overflow-hidden">
          <img
            src={event.cover}
            alt={event.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {event.status === "ongoing" && (
            <span className="absolute top-2 right-2 px-2 py-1 text-xs bg-green-600 text-white rounded">
              Live Now
            </span>
          )}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-primary line-clamp-2">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <MapPin className="h-3 w-3" />
              {locationStr}
            </p>
          </div>
          {isPast && (
            <span className="ml-2 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
              Past
            </span>
          )}
        </div>

        {/* Description preview (strip HTML) */}
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {event.description.replace(/<[^>]*>/g, "")}
          </p>
        )}

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-primary mb-3">
          <Clock className="h-3 w-3" />
          <span>{formatEventDate(event.start_date, event.timezone)}</span>
        </div>

        {/* Action buttons */}
        <div className="mt-auto pt-4 flex gap-2">
          <button
            onClick={() => onViewDetails(event)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            <Eye className="h-3 w-3" />
            Details
          </button>
          {!isPast && (
            <a
              href={eventoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              RSVP
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsGrid({
  events,
  onEventClick,
}: {
  events: EventoEmbedEvent[];
  onEventClick: (event: EventoEmbedEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4 mx-auto" />
        <h3 className="text-lg font-semibold mb-2">No events found</h3>
        <p className="text-sm text-muted-foreground">
          Check back soon for upcoming Bitcoin events
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onViewDetails={onEventClick} />
      ))}
    </div>
  );
}

export default function Events() {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventoEmbedEvent | null>(
    null
  );
  const { events, isLoading, error, refresh } = useEvents(filter);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filterButtons: { value: EventFilter; label: string }[] = [
    { value: "all", label: "All Events" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past Events" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Bitcoin Events
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Join the Caribbean Bitcoin community at meetups, workshops, and
            celebrations
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                data-state={filter === btn.value ? "active" : "inactive"}
                className={cn(
                  "px-4 py-2 text-sm rounded-md transition-colors",
                  filter === btn.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {btn.label}
              </button>
            ))}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex items-center gap-2"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div
            className="flex justify-center py-12"
            data-testid="loading-indicator"
          >
            <Calendar className="h-12 w-12 text-primary/50 animate-pulse" />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center max-w-2xl mx-auto">
            <AlertCircle className="h-12 w-12 text-destructive/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">
              Unable to load events
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please try again later
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <EventsGrid events={events} onEventClick={setSelectedEvent} />

            <div className="text-center mt-12">
              <a
                href="https://evento.so/islandbitcoin"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors"
              >
                View All Events on Evento
              </a>
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                RSVP directly on Evento for the latest updates and event
                details.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-primary">
                  {selectedEvent.title}
                </h2>
                <div className="flex gap-2 mt-1">
                  {selectedEvent.status === "ongoing" && (
                    <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                      Live Now
                    </span>
                  )}
                  {selectedEvent.status === "past" && (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                      Past Event
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                &times;
              </button>
            </div>

            {/* RSVP button */}
            {selectedEvent.status !== "past" && (
              <a
                href={getEventoUrl(selectedEvent.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mb-4"
              >
                RSVP on Evento
                <ExternalLink className="h-4 w-4 inline ml-2" />
              </a>
            )}

            {/* Cover image */}
            {selectedEvent.cover && (
              <div className="rounded-lg overflow-hidden mb-4">
                <img
                  src={selectedEvent.cover}
                  alt={selectedEvent.title}
                  className="w-full h-auto max-h-64 object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              {/* Date and Time */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {formatEventDate(
                      selectedEvent.start_date,
                      selectedEvent.timezone
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatEventTime(
                      selectedEvent.start_date,
                      selectedEvent.end_date,
                      selectedEvent.timezone
                    )}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <p className="font-semibold">
                  {formatLocation(selectedEvent.location)}
                </p>
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <h3 className="font-semibold mb-2">About this event</h3>
                  <div
                    className="text-muted-foreground prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{
                      __html: selectedEvent.description,
                    }}
                  />
                </div>
              )}

              {/* Creator */}
              {selectedEvent.creator && (
                <div className="flex items-center gap-3 pt-4 border-t">
                  {selectedEvent.creator.image && (
                    <img
                      src={selectedEvent.creator.image}
                      alt={selectedEvent.creator.username}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <p className="text-sm font-medium">
                    Organized by @{selectedEvent.creator.username}
                    {selectedEvent.creator.verified && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                        Verified
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* View on Evento */}
              <a
                href={getEventoUrl(selectedEvent.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm"
              >
                View on Evento
                <ExternalLink className="h-4 w-4 inline ml-2" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
