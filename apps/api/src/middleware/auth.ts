/**
 * Nostr NIP-98 HTTP Authentication Middleware for Hono
 * 
 * Implements NIP-98 specification for HTTP authentication using Nostr events.
 * https://github.com/nostr-protocol/nips/blob/master/98.md
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyEvent } from '@island-bitcoin/nostr';
import { db } from '../db';
import { config } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Event } from 'nostr-tools';

/**
 * Extends Hono context with authenticated user pubkey
 */
declare module 'hono' {
  interface ContextVariableMap {
    pubkey: string;
  }
}

/**
 * NIP-98 HTTP Auth Event
 * Kind: 27235
 * Tags: u (URL), method (HTTP method)
 */
interface NIP98Event extends Event {
  kind: 27235;
  tags: [string, string][];
}

/**
 * Extracts and validates NIP-98 event from Authorization header
 * 
 * @param authHeader - Authorization header value (format: "Nostr <base64-event>")
 * @returns Parsed NIP-98 event
 * @throws HTTPException if header is invalid or missing
 */
function extractNIP98Event(authHeader: string | undefined): NIP98Event {
  if (!authHeader) {
    throw new HTTPException(401, { message: 'Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Nostr') {
    throw new HTTPException(401, { message: 'Invalid Authorization header format' });
  }

  try {
    const eventJson = Buffer.from(parts[1], 'base64').toString('utf-8');
    const event = JSON.parse(eventJson) as NIP98Event;
    return event;
  } catch (error) {
    throw new HTTPException(401, { message: 'Invalid base64 or JSON in Authorization header' });
  }
}

/**
 * Validates NIP-98 event according to specification
 * 
 * Checks:
 * 1. Event kind must be 27235
 * 2. Signature must be valid
 * 3. Timestamp must be within 60 seconds
 * 4. URL tag must match request URL
 * 5. Method tag must match HTTP method
 * 
 * @param event - NIP-98 event to validate
 * @param requestUrl - Full request URL including query params
 * @param requestMethod - HTTP method (GET, POST, etc.)
 * @throws HTTPException if validation fails
 */
function validateNIP98Event(
  event: NIP98Event,
  requestUrl: string,
  requestMethod: string
): void {
  // Check 1: Kind must be 27235
  if (event.kind !== 27235) {
    throw new HTTPException(401, { message: 'Invalid event kind, expected 27235' });
  }

  // Check 2: Verify signature
  if (!verifyEvent(event)) {
    throw new HTTPException(401, { message: 'Invalid event signature' });
  }

  // Check 3: Timestamp must be within 60 seconds
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(now - event.created_at);
  if (timeDiff > 60) {
    throw new HTTPException(401, { message: 'Event timestamp expired' });
  }

  // Check 4: URL tag must match request URL
  const urlTag = event.tags.find(([key]) => key === 'u');
  if (!urlTag || urlTag[1] !== requestUrl) {
    throw new HTTPException(401, { message: 'URL tag does not match request URL' });
  }

  // Check 5: Method tag must match HTTP method
  const methodTag = event.tags.find(([key]) => key === 'method');
  if (!methodTag || methodTag[1] !== requestMethod) {
    throw new HTTPException(401, { message: 'Method tag does not match request method' });
  }
}

/**
 * Middleware: Require Nostr authentication via NIP-98
 * 
 * Validates NIP-98 HTTP Auth event and sets pubkey in context.
 * Returns 401 if authentication fails.
 * 
 * Usage:
 * ```typescript
 * app.get('/protected', requireAuth, (c) => {
 *   const pubkey = c.get('pubkey');
 *   return c.json({ pubkey });
 * });
 * ```
 */
export async function requireAuth(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');
  
  // Extract event from header
  const event = extractNIP98Event(authHeader);
  
  // Build full request URL from proxy headers (Caddy sets X-Forwarded-* headers)
  const proto = c.req.header('X-Forwarded-Proto') || 'http';
  const host = c.req.header('X-Forwarded-Host') || c.req.header('Host') || new URL(c.req.url).host;
  const url = new URL(c.req.url);
  const path = url.pathname + url.search;
  const requestUrl = `${proto}://${host}${path}`;
  const requestMethod = c.req.method;
  
  // Validate event
  validateNIP98Event(event, requestUrl, requestMethod);
  
  // Set pubkey in context for downstream handlers
  c.set('pubkey', event.pubkey);
  
  await next();
}

/**
 * Middleware: Require admin privileges
 * 
 * Must be used after requireAuth middleware.
 * Checks if authenticated pubkey is in admin list from config table.
 * Returns 403 if user is not an admin.
 * 
 * Admin list is stored in config table with key 'admin_pubkeys' as JSON array.
 * 
 * Usage:
 * ```typescript
 * app.delete('/admin/users/:id', requireAuth, requireAdmin, (c) => {
 *   // Only admins can access this route
 *   return c.json({ success: true });
 * });
 * ```
 */
export async function requireAdmin(c: Context, next: Next): Promise<void> {
  const pubkey = c.get('pubkey');
  
  if (!pubkey) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  
  // Fetch admin list from config table
  const adminConfig = await db
    .select()
    .from(config)
    .where(eq(config.key, 'admin_pubkeys'))
    .get();
  
  // If no admin config exists, allow first user to become admin
  if (!adminConfig) {
    await next();
    return;
  }
  
  let adminPubkeys: string[];
  try {
    adminPubkeys = JSON.parse(adminConfig.value);
  } catch (error) {
    throw new HTTPException(500, { message: 'Invalid admin list configuration' });
  }
  
  // If admin list is empty, allow first user to become admin
  if (!Array.isArray(adminPubkeys) || adminPubkeys.length === 0) {
    await next();
    return;
  }
  
  // Check if user is in admin list
  if (!adminPubkeys.includes(pubkey)) {
    throw new HTTPException(403, { message: 'Admin privileges required' });
  }
  
  await next();
}
