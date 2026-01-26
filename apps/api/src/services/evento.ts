import { createNostrClient } from '@island-bitcoin/nostr';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number | null;
  location: string;
  pubkey: string;
}

// Expanded relay list for better NIP-52 calendar event coverage
// Includes relays used by Flockstr (calendar app) and other high-reliability relays
const DEFAULT_RELAYS = [
  // Primary - Flash's relay (Island Bitcoin events)
  'wss://relay.flashapp.me',
  
  // Tier 1: Most reliable & fast (from Flockstr + NDK)
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  
  // Tier 2: Good redundancy & search capable
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  
  // Tier 3: Additional coverage (from Flockstr)
  'wss://nostr.mom',
  'wss://purplepag.es',
  'wss://offchain.pub',
  'wss://nostr.oxtr.dev',
];

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
  };
}

async function fetchNip52Events(relays: string[] = DEFAULT_RELAYS): Promise<CalendarEvent[]> {
  const client = createNostrClient(relays);
  const events: CalendarEvent[] = [];

  try {
    const filter = { kinds: [NIP52_KIND], limit: 100 };
    
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      for await (const msg of client.req([filter], { signal: controller.signal })) {
        if (msg[0] === 'EVENT') {
          const parsed = parseNip52Event(msg[2] as { kind: number; tags: string[][]; content: string; pubkey: string });
          if (parsed) {
            events.push(parsed);
          }
        }
        if (msg[0] === 'EOSE') {
          break;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('NIP-52 fetch error:', error);
  }

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
