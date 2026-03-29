import { WebSocket } from 'ws';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number | null;
  location: string;
  pubkey: string;
  registrationUrl?: string;
}

// Reliable relays for NIP-52 calendar event queries
const DEFAULT_RELAYS = [
  'wss://relay.islandbitcoin.com',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const ISLAND_BITCOIN_PUBKEY = '96f18e1a3647574bdacfb3b64172c66b39be6b917290f12c7f18bcd0aed6ba2c';

const CACHE_TTL_MS = 5 * 60 * 1000;
const EVENTO_CACHE_TTL_MS = 10 * 60 * 1000;
const NIP52_KIND = 31923;

// Default known Evento event IDs for Island Bitcoin.
// Override via EVENTO_EVENT_IDS env var (comma-separated list of evt_* IDs).
const DEFAULT_EVENTO_EVENT_IDS = ['evt_zRt3yEMyk1zuud55'];

const EVENTO_BASE_URL = 'https://app.evento.so/api/v1';

interface CacheEntry {
  events: CalendarEvent[];
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();

function isCacheValid(key: string, ttl = CACHE_TTL_MS): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < ttl;
}

function getCached(key: string, ttl?: number): CalendarEvent[] | null {
  if (isCacheValid(key, ttl)) {
    return cache.get(key)!.events;
  }
  return null;
}

function setCache(key: string, events: CalendarEvent[]): void {
  cache.set(key, { events, timestamp: Date.now() });
}

export function clearEventsCache(): void {
  cache.clear();
}

function parseNip52Event(event: { kind: number; tags: string[][]; content: string; pubkey: string }): CalendarEvent | null {
  if (event.kind !== NIP52_KIND) return null;

  const getTag = (name: string): string => {
    const tag = event.tags.find(t => t[0] === name);
    return tag ? tag[1] : '';
  };

   const id = getTag('d');
   const title = getTag('title');
   const startStr = getTag('start');
   const endStr = getTag('end');
   const location = getTag('location');
   const registrationUrl = getTag('r');

  if (!id || !title || !startStr) return null;

  const start = parseInt(startStr, 10);
  if (isNaN(start)) return null;

  const end = endStr ? parseInt(endStr, 10) : null;

   return {
     id,
     title,
     description: event.content || '',
     start,
     end: end && !isNaN(end) ? end : null,
     location: location || '',
     pubkey: event.pubkey,
     registrationUrl: registrationUrl || undefined,
   };
}

async function fetchNip52Events(relays: string[] = DEFAULT_RELAYS): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  console.log('[fetchNip52Events] Starting - relays:', relays.length);
  const startTime = Date.now();

  const queryRelay = (url: string): Promise<CalendarEvent[]> => {
    return new Promise((resolve) => {
      const relayEvents: CalendarEvent[] = [];
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(relayEvents);
      }, 10000);

       ws.on('open', () => {
         console.log('[fetchNip52Events] Connected to', url);
         ws.send(JSON.stringify(['REQ', 'nip52', { kinds: [NIP52_KIND], authors: [ISLAND_BITCOIN_PUBKEY], limit: 100 }]));
       });

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg[0] === 'EVENT' && msg[2]) {
            const parsed = parseNip52Event(msg[2]);
            if (parsed) {
              relayEvents.push(parsed);
              console.log('[fetchNip52Events] Event from', url, ':', parsed.title);
            }
          }
          if (msg[0] === 'EOSE') {
            console.log('[fetchNip52Events] EOSE from', url);
            clearTimeout(timeout);
            ws.close();
            resolve(relayEvents);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (err) => {
        console.log('[fetchNip52Events] Error from', url, ':', err.message);
        clearTimeout(timeout);
        resolve(relayEvents);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(relayEvents);
      });
    });
  };

  try {
    const relaysToQuery = relays.slice(0, 4);
    const results = await Promise.allSettled(relaysToQuery.map(queryRelay));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const event of result.value) {
          if (!seenIds.has(event.id)) {
            seenIds.add(event.id);
            events.push(event);
          }
        }
      }
    }
  } catch (error) {
    console.error('[fetchNip52Events] Error:', error);
  }

  console.log('[fetchNip52Events] Completed in', Date.now() - startTime, 'ms. Total events:', events.length);
  return events;
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
}

/**
 * Fetch events from Evento.so by their known event IDs.
 *
 * Configure which events to pull via the EVENTO_EVENT_IDS environment variable
 * (comma-separated list of evt_* IDs). Defaults to the known Island Bitcoin event ID.
 *
 * No API key is needed — these are public event endpoints.
 *
 * Example:
 *   EVENTO_EVENT_IDS=evt_zRt3yEMyk1zuud55,evt_abc123
 */
export async function fetchEventoEvents(): Promise<CalendarEvent[]> {
  const cacheKey = 'eventos:fetched';
  const cached = getCached(cacheKey, EVENTO_CACHE_TTL_MS);
  if (cached) return cached;

  // Read event IDs from env, fall back to defaults
  const envIds = process.env.EVENTO_EVENT_IDS;
  const eventIds = envIds
    ? envIds.split(',').map(id => id.trim()).filter(Boolean)
    : DEFAULT_EVENTO_EVENT_IDS;

  if (eventIds.length === 0) {
    console.log('[fetchEventoEvents] No event IDs configured, skipping');
    return [];
  }

  console.log('[fetchEventoEvents] Fetching', eventIds.length, 'Evento events');
  const startTime = Date.now();

  const fetchSingleEvent = async (eventId: string): Promise<CalendarEvent | null> => {
    try {
      const res = await fetch(`${EVENTO_BASE_URL}/events/${eventId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[fetchEventoEvents] HTTP ${res.status} for event ${eventId}`);
        return null;
      }

      const json = await res.json() as {
        success: boolean;
        data: {
          id: string;
          title: string;
          description: string;
          computed_start_date: string;
          computed_end_date: string | null;
          status: string;
          visibility: string;
          event_locations: { name: string } | null;
          user_details: { id: string; username: string } | null;
        };
      };

      if (!json.success || !json.data || !json.data.id) {
        console.warn(`[fetchEventoEvents] Invalid response for event ${eventId}`);
        return null;
      }

      const d = json.data;

      // Only include published public events
      if (d.status !== 'published' || d.visibility !== 'public') {
        console.log(`[fetchEventoEvents] Skipping non-public event ${eventId} (status=${d.status}, visibility=${d.visibility})`);
        return null;
      }

      const start = d.computed_start_date ? Math.floor(new Date(d.computed_start_date).getTime() / 1000) : null;
      if (!start) {
        console.warn(`[fetchEventoEvents] Could not parse start date for event ${eventId}`);
        return null;
      }

      const end = d.computed_end_date ? Math.floor(new Date(d.computed_end_date).getTime() / 1000) : null;

      return {
        id: `evento:${d.id}`,
        title: d.title || '',
        description: d.description ? stripHtml(d.description) : '',
        start,
        end,
        location: d.event_locations?.name || '',
        pubkey: d.user_details?.id || '',
        registrationUrl: `https://app.evento.so/e/${d.id}`,
      };
    } catch (err) {
      console.error(`[fetchEventoEvents] Error fetching event ${eventId}:`, err);
      return null;
    }
  };

  const results = await Promise.allSettled(eventIds.map(fetchSingleEvent));
  const events: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      events.push(result.value);
    }
  }

  console.log('[fetchEventoEvents] Completed in', Date.now() - startTime, 'ms. Got', events.length, 'events');
  setCache(cacheKey, events);
  return events;
}

export async function fetchUpcomingEvents(relays?: string[]): Promise<CalendarEvent[]> {
  const cacheKey = 'events:upcoming';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const now = Math.floor(Date.now() / 1000);
  
  // Fetch from both sources in parallel
  const [nostrEvents, eventoEvents] = await Promise.all([
    fetchNip52Events(relays),
    fetchEventoEvents(),
  ]);

  // Merge and deduplicate by ID
  const seenIds = new Set<string>();
  const allEvents: CalendarEvent[] = [];
  for (const event of [...nostrEvents, ...eventoEvents]) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      allEvents.push(event);
    }
  }

  const upcoming = allEvents
    .filter(e => e.start >= now)
    .sort((a, b) => a.start - b.start);

  setCache(cacheKey, upcoming);
  return upcoming;
}

export async function fetchPastEvents(relays?: string[]): Promise<CalendarEvent[]> {
  const cacheKey = 'events:past';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const now = Math.floor(Date.now() / 1000);
  
  // Fetch from both sources in parallel
  const [nostrEvents, eventoEvents] = await Promise.all([
    fetchNip52Events(relays),
    fetchEventoEvents(),
  ]);

  // Merge and deduplicate by ID
  const seenIds = new Set<string>();
  const allEvents: CalendarEvent[] = [];
  for (const event of [...nostrEvents, ...eventoEvents]) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      allEvents.push(event);
    }
  }

  const past = allEvents
    .filter(e => e.start < now)
    .sort((a, b) => b.start - a.start);

  setCache(cacheKey, past);
  return past;
}
