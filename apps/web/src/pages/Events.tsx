import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, AlertCircle, RefreshCw, ArrowLeft, MapPin, Clock, Users, Zap, Eye, ExternalLink } from "lucide-react";
import { useEvents, type EventFilter } from "@/hooks/useEvents";
import type { EventWithDate } from "@/types/events";
import { cn } from "@/lib/utils";

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "meetup":
    case "social":
      return <Users className="h-4 w-4" />;
    case "workshop":
      return <Calendar className="h-4 w-4" />;
    case "conference":
    case "special":
    default:
      return <Zap className="h-4 w-4" />;
  }
}

function formatEventDate(event: EventWithDate): string {
  const date = event.nextDate || new Date(event.event.event.datetime.start);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function EventCard({ item, onViewDetails }: { item: EventWithDate; onViewDetails: (event: EventWithDate) => void }) {
  const event = item.event.event;
  const location = event.location;
  const locationString = location?.address
    ? `${location.address.city}, ${location.address.country}`
    : location?.name || "Location TBD";
  const isPastEvent = !item.nextDate;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-6 transition-all hover:shadow-lg hover:border-primary/30 flex flex-col h-full",
        isPastEvent && "opacity-60 hover:opacity-80"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-primary line-clamp-2">
            {event.basic_info.title}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <MapPin className="h-3 w-3" />
            {locationString}
          </p>
        </div>
        {isPastEvent && (
          <span className="ml-2 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
            Past
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
        {event.basic_info.summary || event.basic_info.description}
      </p>

      <div className="flex items-center gap-2 text-sm text-primary mb-3">
        <Clock className="h-3 w-3" />
        <span>{formatEventDate(item)}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <EventIcon type={event.basic_info.type} />
          <span className="capitalize">{event.basic_info.type}</span>
        </div>

        <div className="flex gap-2">
          {event.registration?.fee?.amount === 0 && (
            <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
              Free
            </span>
          )}
          {event.datetime.recurring?.enabled && !isPastEvent && (
            <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
              Recurring
            </span>
          )}
        </div>
      </div>

      {event.basic_info.tags && event.basic_info.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {event.basic_info.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {event.basic_info.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{event.basic_info.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto pt-4 flex gap-2">
        <button
          onClick={() => onViewDetails(item)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          <Eye className="h-3 w-3" />
          Details
        </button>
        {event.registration?.url && !isPastEvent && (
          <a
            href={event.registration.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Register
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function EventsGrid({ events, onEventClick }: { events: EventWithDate[]; onEventClick: (event: EventWithDate) => void }) {
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
      {events.map((item) => (
        <EventCard key={item.event.event.id} item={item} onViewDetails={onEventClick} />
      ))}
    </div>
  );
}

export default function Events() {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithDate | null>(null);
  const { events, isLoading, error, refresh } = useEvents(filter);

  const handleRefresh = async () => {
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
            Join the Caribbean Bitcoin community at meetups, workshops, and celebrations
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
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12" data-testid="loading-indicator">
            <Calendar className="h-12 w-12 text-primary/50 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center max-w-2xl mx-auto">
            <AlertCircle className="h-12 w-12 text-destructive/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">Unable to load events</h3>
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
                href={`https://github.com/islandbitcoin/islandbitcoin-community/issues/new?title=Event%20Submission:%20[Your%20Event%20Name]&body=${encodeURIComponent(`## Event Submission Template

**Event Name:** [Your Event Name]

**Country, Location:** [City, Country]

**Date and Time:** [Date]

**Description:** 
[Describe your event]

**Event Type:** 
- [ ] One-time event
- [ ] Recurring event
- [ ] Workshop
- [ ] Conference
- [ ] Meetup
- [ ] Other: ___________

**Registration/RSVP Link:** [If applicable]

**Contact Information:**
- Organizer Name: 
- Nostr npub: 
- Email/Other: 

---
*Please fill out all applicable fields above and submit this issue. We'll review and add your event to Island Bitcoin!*`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors"
              >
                Submit an Event
              </a>
            </div>
          </>
        )}
      </div>

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
              <h2 className="text-2xl font-bold text-primary">
                {selectedEvent.event.event.basic_info.title}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <p className="text-muted-foreground mb-4">
              {selectedEvent.event.event.basic_info.description}
            </p>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Date:</strong> {formatEventDate(selectedEvent)}
              </p>
              <p>
                <strong>Location:</strong>{" "}
                {selectedEvent.event.event.location?.name || "TBD"}
              </p>
              <p>
                <strong>Organizer:</strong>{" "}
                {selectedEvent.event.event.organizer.name}
              </p>
            </div>
            {selectedEvent.event.event.registration?.url && !selectedEvent.nextDate === null && (
              <a
                href={selectedEvent.event.event.registration.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Register
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
