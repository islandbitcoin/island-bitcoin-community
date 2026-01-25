import { NPool, NRelay1 } from "@nostrify/nostrify";

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
