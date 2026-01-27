/**
 * NIP-07: window.nostr capability for signing Nostr events
 * https://github.com/nostr-protocol/nips/blob/master/07.md
 */

interface NostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
  id?: string;
  sig?: string;
}

interface WindowNostr {
  /**
   * Returns the public key of the user (as hex string)
   */
  getPublicKey(): Promise<string>;

  /**
   * Signs an event and returns the signed event with id and sig
   */
  signEvent(event: NostrEvent): Promise<NostrEvent>;

  /**
   * Optional: Get relays the user is connected to
   */
  getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;

  /**
   * Optional: Request user to sign a message
   */
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

export {};
