import { WebSocket } from 'ws';
import { NPool, NRelay1 } from "@nostrify/nostrify";

// Polyfill WebSocket for Node.js environment
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

/**
 * Creates a Nostr client connected to specified relays
 * @param relays - Array of relay URLs to connect to
 * @returns NPool client instance
 */
export function createNostrClient(relays: string[]) {
  return new NPool({
    open: (url: string) => new NRelay1(url),
    reqRouter: async () => {
      const map = new Map<string, any[]>();
      for (const relay of relays) {
        map.set(relay, []);
      }
      return map;
    },
    eventRouter: async () => relays,
  });
}
