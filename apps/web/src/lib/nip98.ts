/**
 * NIP-98 HTTP Authentication Helper
 * 
 * Implements NIP-98 specification for HTTP authentication using Nostr events.
 * https://github.com/nostr-protocol/nips/blob/master/98.md
 * 
 * Generates signed auth events for API requests that require NIP-98 authentication.
 */

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
 * The event is signed using the user's Nostr key via window.nostr.signEvent().
 * 
 * The returned header can be used in HTTP requests like:
 * ```typescript
 * const authHeader = await createNIP98AuthHeader('https://api.example.com/config', 'GET');
 * fetch('https://api.example.com/config', {
 *   headers: { Authorization: authHeader }
 * });
 * ```
 * 
 * @param url - Full URL of the API endpoint (must match exactly in request)
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @returns Promise resolving to Authorization header value in format "Nostr <base64-event>"
 * @throws Error if window.nostr is not available or signing fails
 */
export async function createNIP98AuthHeader(
  url: string,
  method: string
): Promise<string> {
  // Check if window.nostr is available
  if (!window.nostr) {
    throw new Error('window.nostr is not available. Please install a Nostr extension.');
  }

  const nostr = window.nostr as WindowNostr;

  // Get user's public key
  const pubkey = await nostr.getPublicKey();

  // Create unsigned event
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

  // Sign the event (window.nostr.signEvent calculates the ID internally)
  const signedEvent: SignedNIP98Event = await nostr.signEvent(unsignedEvent);

  // Serialize and base64 encode the signed event
  const eventJson = JSON.stringify(signedEvent);
  const eventBase64 = btoa(eventJson);

  // Return in NIP-98 format
  return `Nostr ${eventBase64}`;
}
