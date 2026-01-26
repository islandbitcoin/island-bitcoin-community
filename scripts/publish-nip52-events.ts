import WebSocket from 'ws';
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

import { createNostrClient } from '@island-bitcoin/nostr';
import { finalizeEvent, nip19, getPublicKey } from 'nostr-tools';
import type { EventTemplate } from 'nostr-tools';

const GITHUB_API = 'https://api.github.com/repos/islandbitcoin/islandbitcoin-community/contents/events';
const RELAYS = process.env.NOSTR_RELAYS?.split(',') || [
  'wss://relay.flashapp.me',
  'wss://relay.damus.io',
  'wss://nostr.oxtr.dev'
];

const NIP52_KIND = 31923;

interface EventoEvent {
  event: {
    id: string;
    status: string;
    basic_info: {
      title: string;
      description: string;
    };
    datetime: {
      start: string;
      end: string;
    };
    location: {
      name: string;
      address?: {
        city: string;
        country: string;
        coordinates?: {
          latitude: number;
          longitude: number;
        };
      };
    };
  };
}

interface GitHubFile {
  name: string;
  download_url: string;
  type: string;
}

async function fetchGitHubEvents(): Promise<EventoEvent[]> {
  console.log('Fetching event list from GitHub...');
  
  const response = await fetch(GITHUB_API, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'island-bitcoin-publisher'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const files: GitHubFile[] = await response.json();
  const jsonFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.json'));
  
  console.log(`Found ${jsonFiles.length} event files`);

  const events: EventoEvent[] = [];
  
  for (const file of jsonFiles) {
    console.log(`Downloading: ${file.name}`);
    const eventResponse = await fetch(file.download_url);
    
    if (!eventResponse.ok) {
      console.error(`Failed to download ${file.name}: ${eventResponse.status}`);
      continue;
    }
    
    const eventData: EventoEvent = await eventResponse.json();
    events.push(eventData);
  }

  return events;
}

function transformToNIP52(event: EventoEvent): EventTemplate {
  const { id, basic_info, datetime, location } = event.event;
  
  const startUnix = Math.floor(new Date(datetime.start).getTime() / 1000);
  const endUnix = Math.floor(new Date(datetime.end).getTime() / 1000);
  
  const locationStr = location.address 
    ? `${location.name}, ${location.address.city}, ${location.address.country}`
    : location.name;
  
  const tags: string[][] = [
    ['d', id],
    ['title', basic_info.title],
    ['start', startUnix.toString()],
    ['end', endUnix.toString()],
    ['location', locationStr]
  ];
  
  if (location.address?.coordinates) {
    const { latitude, longitude } = location.address.coordinates;
    tags.push(['g', `${latitude},${longitude}`]);
  }
  
  return {
    kind: NIP52_KIND,
    content: basic_info.description,
    tags,
    created_at: Math.floor(Date.now() / 1000)
  };
}

function decodeNsec(nsec: string): Uint8Array {
  if (nsec.startsWith('nsec')) {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    return decoded.data;
  }
  return Uint8Array.from(Buffer.from(nsec, 'hex'));
}

async function eventExists(client: ReturnType<typeof createNostrClient>, dTag: string, pubkey: string): Promise<boolean> {
  try {
    const filter = {
      kinds: [NIP52_KIND],
      authors: [pubkey],
      '#d': [dTag],
      limit: 1
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      for await (const msg of client.req([filter], { signal: controller.signal })) {
        if (msg[0] === 'EVENT') {
          clearTimeout(timeout);
          return true;
        }
        if (msg[0] === 'EOSE') {
          break;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn(`Could not check for existing event: ${error}`);
  }
  return false;
}

async function publishToRelays(client: ReturnType<typeof createNostrClient>, signedEvent: ReturnType<typeof finalizeEvent>): Promise<boolean> {
  try {
    await client.event(signedEvent);
    return true;
  } catch (error) {
    console.error('Failed to publish event:', error);
    return false;
  }
}

async function publishEvents() {
  const nsec = process.env.NOSTR_BUILD_NSEC;
  if (!nsec) {
    throw new Error('NOSTR_BUILD_NSEC environment variable not set');
  }

  const secretKey = decodeNsec(nsec);
  const pubkey = getPublicKey(secretKey);
  console.log(`Publishing as: ${nip19.npubEncode(pubkey)}`);
  console.log(`Using relays: ${RELAYS.join(', ')}`);

  const client = createNostrClient(RELAYS);

  const events = await fetchGitHubEvents();
  console.log(`\nFound ${events.length} events to process`);

  const publishedEvents = events.filter(e => e.event.status === 'published');
  console.log(`${publishedEvents.length} events have 'published' status\n`);

  let successCount = 0;
  let skippedCount = 0;

  for (const event of publishedEvents) {
    const title = event.event.basic_info.title;
    const dTag = event.event.id;

    const exists = await eventExists(client, dTag, pubkey);
    if (exists) {
      console.log(`Skipped (already exists): ${title}`);
      skippedCount++;
      continue;
    }

    const nip52Event = transformToNIP52(event);
    const signedEvent = finalizeEvent(nip52Event, secretKey);
    const success = await publishToRelays(client, signedEvent);
    
    if (success) {
      console.log(`Published: ${title}`);
      successCount++;
    } else {
      console.error(`Failed to publish: ${title}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total events: ${events.length}`);
  console.log(`Published status: ${publishedEvents.length}`);
  console.log(`Successfully published: ${successCount}`);
  console.log(`Skipped (already exists): ${skippedCount}`);
  console.log(`Failed: ${publishedEvents.length - successCount - skippedCount}`);
}

publishEvents()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
