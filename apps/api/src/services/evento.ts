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
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const ISLAND_BITCOIN_PUBKEY = '96f18e1a3647574bdacfb3b64172c66b39be6b917290f12c7f18bcd0aed6ba2c';

const CACHE_TTL_MS = 5 * 60 * 1000;
const NIP52_KIND = 31923;

interface CacheEntry {
  events: CalendarEvent[];
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function getCached(key: string): CalendarEvent[] | null {
  if (isCacheValid(key)) {
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
    const relaysToQuery = relays.slice(0, 3);
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

// TODO: Implement when Evento API key is available
export async function fetchEventoEvents(_apiKey?: string): Promise<CalendarEvent[]> {
  return [];
}

export async function fetchUpcomingEvents(relays?: string[]): Promise<CalendarEvent[]> {
  const cacheKey = 'events:upcoming';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const now = Math.floor(Date.now() / 1000);
  
  const allEvents = await fetchNip52Events(relays);
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
  
  const allEvents = await fetchNip52Events(relays);
  const past = allEvents
    .filter(e => e.start < now)
    .sort((a, b) => b.start - a.start);

  setCache(cacheKey, past);
  return past;
}
