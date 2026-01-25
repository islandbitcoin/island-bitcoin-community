import { verifyEvent as verifyEventNostrTools } from "nostr-tools";
import type { Event } from "nostr-tools";

export interface Signer {
  sign(event: Event): Promise<string>;
}

/**
 * Signs a Nostr event using the provided signer
 * @param event - The event to sign
 * @param signer - The signer implementation
 * @returns The signature
 */
export async function signEvent(event: Event, signer: Signer): Promise<string> {
  return signer.sign(event);
}

/**
 * Verifies a Nostr event signature
 * @param event - The event to verify
 * @returns True if signature is valid, false otherwise
 */
export function verifyEvent(event: Event): boolean {
  try {
    return verifyEventNostrTools(event);
  } catch {
    return false;
  }
}
