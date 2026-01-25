import type { Event } from "nostr-tools";

export interface Nip24242AuthOptions {
  pubkey: string;
  method: "upload" | "list" | "delete";
  sha256?: string;
  content?: string;
  expirationSeconds?: number;
}

/**
 * Creates a NIP-24242 authorization event for Blossom HTTP auth
 * Used for upload, list, and delete operations on Blossom servers
 * @param options - Authorization options
 * @returns Unsigned event object (caller must sign)
 */
export function nip24242Auth(options: Nip24242AuthOptions): Omit<Event, "sig" | "id"> {
  const now = Math.floor(Date.now() / 1000);
  const expiration = options.expirationSeconds
    ? now + options.expirationSeconds
    : now + 86400; // 24 hours default

  const tags: string[][] = [["t", options.method]];

  if (options.sha256) {
    tags.push(["x", options.sha256]);
  }

  tags.push(["expiration", expiration.toString()]);

  return {
    kind: 24242,
    pubkey: options.pubkey,
    created_at: now,
    content: options.content || `${options.method.charAt(0).toUpperCase() + options.method.slice(1)} request`,
    tags,
  };
}
