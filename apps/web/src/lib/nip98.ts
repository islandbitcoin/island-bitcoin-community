/**
 * NIP-98 HTTP Authentication Helper
 * 
 * Implements NIP-98 specification for HTTP authentication using Nostr events.
 * https://github.com/nostr-protocol/nips/blob/master/98.md
 * 
 * Generates signed auth events for API requests that require NIP-98 authentication.
 */

import type { NostrSigner } from "@nostrify/nostrify";

/**
 * Unsigned NIP-98 event structure
 */
interface UnsignedNIP98Event {
  kind: 27235;
  created_at: number;
  tags: [string, string][];
  content: string;
  pubkey: string;
}

/**
 * Signed NIP-98 event structure
 */
interface SignedNIP98Event extends UnsignedNIP98Event {
  id: string;
  sig: string;
}

/**
 * Window.nostr API interface
 */
interface WindowNostr {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNIP98Event): Promise<SignedNIP98Event>;
}

/**
 * Creates a NIP-98 HTTP authentication header for API requests
 * 
 * Generates a signed Nostr event (kind 27235) that authenticates HTTP requests.
 * The event is signed using either a provided NostrSigner or window.nostr.
 * 
 * The returned header can be used in HTTP requests like:
 * ```typescript
 * const authHeader = await createNIP98AuthHeader('https://api.example.com/config', 'GET', user.signer);
 * fetch('https://api.example.com/config', {
 *   headers: { Authorization: authHeader }
 * });
 * ```
 * 
 * @param url - Full URL of the API endpoint (must match exactly in request)
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param signer - Optional NostrSigner (from NUser.signer). Falls back to window.nostr if not provided.
 * @returns Promise resolving to Authorization header value in format "Nostr <base64-event>"
 * @throws Error if neither signer nor window.nostr is available
 */
export async function createNIP98AuthHeader(
  url: string,
  method: string,
  signer?: NostrSigner
): Promise<string> {
  let pubkey: string;
  let signedEvent: SignedNIP98Event;

  if (signer) {
    // Use provided signer (nsec, bunker, or extension login via @nostrify/react)
    pubkey = await signer.getPublicKey();

    // Create unsigned event
    const unsignedEvent = {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', url],
        ['method', method],
      ],
      content: '',
    };

    // Sign with NostrSigner (returns full event with id, pubkey, sig)
    signedEvent = await signer.signEvent(unsignedEvent) as SignedNIP98Event;
  } else if (window.nostr) {
    // Fallback to window.nostr for extension users
    const nostr = window.nostr as WindowNostr;
    pubkey = await nostr.getPublicKey();

    const unsignedEvent: UnsignedNIP98Event = {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', url],
        ['method', method],
      ],
      content: '',
      pubkey,
    };

    signedEvent = await nostr.signEvent(unsignedEvent);
  } else {
    throw new Error('No signer available. Please log in with a Nostr extension or nsec.');
  }

  // Serialize and base64 encode the signed event
  const eventJson = JSON.stringify(signedEvent);
  const eventBase64 = btoa(eventJson);

  // Return in NIP-98 format
  return `Nostr ${eventBase64}`;
}
