import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, requireAdmin } from './auth';
import { db } from '../db';
import { config } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools';

const TEST_SECRET_KEY = generateSecretKey();
const TEST_PUBKEY = getPublicKey(TEST_SECRET_KEY);

function createNIP98Event(url: string, method: string, secretKey: Uint8Array = TEST_SECRET_KEY) {
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
  };
  
  return finalizeEvent(event, secretKey);
}

function encodeAuthHeader(event: any): string {
  const base64Event = Buffer.from(JSON.stringify(event)).toString('base64');
  return `Nostr ${base64Event}`;
}

describe('requireAuth middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.get('/test', requireAuth, (c) => {
      return c.json({ pubkey: c.get('pubkey') });
    });
  });

  it('should allow valid NIP-98 event', async () => {
    const url = 'http://localhost/test';
    const method = 'GET';
    const event = createNIP98Event(url, method);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pubkey).toBe(TEST_PUBKEY);
  });

  it('should reject missing Authorization header', async () => {
    const res = await app.request('http://localhost/test', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });

  it('should reject invalid Authorization header format', async () => {
    const res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { Authorization: 'Bearer token123' },
    });

    expect(res.status).toBe(401);
  });

  it('should reject invalid base64 in Authorization header', async () => {
    const res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { Authorization: 'Nostr invalid-base64!!!' },
    });

    expect(res.status).toBe(401);
  });

  it('should reject invalid JSON in Authorization header', async () => {
    const invalidJson = Buffer.from('not-json').toString('base64');
    const res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { Authorization: `Nostr ${invalidJson}` },
    });

    expect(res.status).toBe(401);
  });

  it('should reject event with wrong kind', async () => {
    const url = 'http://localhost/test';
    const method = 'GET';
    const event = createNIP98Event(url, method);
    event.kind = 1;
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(401);
  });

  it('should reject event with invalid signature', async () => {
    const url = 'http://localhost/test';
    const method = 'GET';
    const event = createNIP98Event(url, method);
    event.sig = 'invalid_signature_' + event.sig.slice(18);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(401);
  });

  it('should reject expired event (timestamp > 60 seconds old)', async () => {
    const url = 'http://localhost/test';
    const method = 'GET';
    const event = createNIP98Event(url, method);
    event.created_at = Math.floor(Date.now() / 1000) - 61;
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(401);
  });

  it('should reject event with mismatched URL', async () => {
    const url = 'http://localhost/test';
    const method = 'GET';
    const event = createNIP98Event('http://localhost/different', method);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(401);
  });

  it('should reject event with mismatched method', async () => {
    const url = 'http://localhost/test';
    const event = createNIP98Event(url, 'POST');
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method: 'GET',
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(401);
  });

  it('should handle URL with query parameters', async () => {
    const url = 'http://localhost/test?foo=bar&baz=qux';
    const method = 'GET';
    const event = createNIP98Event(url, method);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(200);
  });

  it('should handle POST requests', async () => {
    app.post('/test-post', requireAuth, (c) => {
      return c.json({ pubkey: c.get('pubkey') });
    });

    const url = 'http://localhost/test-post';
    const method = 'POST';
    const event = createNIP98Event(url, method);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
      body: JSON.stringify({ data: 'test' }),
    });

    expect(res.status).toBe(200);
  });
});

describe('requireAdmin middleware', () => {
  let app: Hono;
  const adminPubkey = TEST_PUBKEY;
  const nonAdminSecretKey = generateSecretKey();
  const nonAdminPubkey = getPublicKey(nonAdminSecretKey);

  beforeEach(async () => {
    await db.delete(config).where(eq(config.key, 'admin_pubkeys'));
    
    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([adminPubkey]),
    });

    app = new Hono();
    app.delete('/admin/test', requireAuth, requireAdmin, (c) => {
      return c.json({ success: true });
    });
  });

  it('should allow admin user', async () => {
    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, TEST_SECRET_KEY);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('should reject non-admin user', async () => {
    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, nonAdminSecretKey);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(403);
  });

  it('should reject when admin list not configured', async () => {
    await db.delete(config).where(eq(config.key, 'admin_pubkeys'));

    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, TEST_SECRET_KEY);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(403);
  });

  it('should reject when admin list is invalid JSON', async () => {
    await db.delete(config).where(eq(config.key, 'admin_pubkeys'));
    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: 'invalid-json',
    });

    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, TEST_SECRET_KEY);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(500);
  });

  it('should reject when admin list is not an array', async () => {
    await db.delete(config).where(eq(config.key, 'admin_pubkeys'));
    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify({ not: 'an array' }),
    });

    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, TEST_SECRET_KEY);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(403);
  });

  it('should work with multiple admins', async () => {
    await db.delete(config).where(eq(config.key, 'admin_pubkeys'));
    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([adminPubkey, nonAdminPubkey]),
    });

    const url = 'http://localhost/admin/test';
    const method = 'DELETE';
    const event = createNIP98Event(url, method, nonAdminSecretKey);
    const authHeader = encodeAuthHeader(event);

    const res = await app.request(url, {
      method,
      headers: { Authorization: authHeader },
    });

    expect(res.status).toBe(200);
  });
});
