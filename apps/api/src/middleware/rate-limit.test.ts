import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createRateLimiter } from './rate-limit';

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within the limit', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 3,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First 3 requests should pass
    for (let i = 0; i < 3; i++) {
      const res = await app.request('http://localhost/test', {
        method: 'GET',
        headers: { 'X-Pubkey': 'user1' },
      });
      expect(res.status).toBe(200);
    }
  });

  it('should return 429 when limit is exceeded', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First 2 requests pass
    for (let i = 0; i < 2; i++) {
      const res = await app.request('http://localhost/test', {
        method: 'GET',
        headers: { 'X-Pubkey': 'user1' },
      });
      expect(res.status).toBe(200);
    }

    // 3rd request should be rate limited
    const res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);
  });

  it('should reset after window expires', async () => {
    const windowMs = 60000;
    const limiter = createRateLimiter({
      windowMs,
      maxRequests: 1,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First request passes
    let res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(200);

    // Second request is rate limited
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);

    // Advance time past window expiry
    vi.advanceTimersByTime(windowMs + 1);

    // Request should pass again
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(200);
  });

  it('should track independent keys separately', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // User1 makes 1 request (passes)
    let res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(200);

    // User1 makes 2nd request (rate limited)
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);

    // User2 makes 1st request (should pass — different key)
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user2' },
    });
    expect(res.status).toBe(200);

    // User2 makes 2nd request (rate limited)
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user2' },
    });
    expect(res.status).toBe(429);
  });

  it('should include Retry-After header on 429 response', async () => {
    const windowMs = 60000;
    const limiter = createRateLimiter({
      windowMs,
      maxRequests: 1,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First request passes
    await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });

    // Second request is rate limited
    const res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);

    // Check Retry-After header exists and is a valid number
    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toBeDefined();
    const retryAfterSeconds = parseInt(retryAfter!, 10);
    expect(retryAfterSeconds).toBeGreaterThan(0);
    expect(retryAfterSeconds).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));
  });

  it('should use custom key extractor', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyExtractor: (c) => c.req.header('X-Custom-Key') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First request with custom key passes
    let res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Custom-Key': 'custom1' },
    });
    expect(res.status).toBe(200);

    // Second request with same custom key is rate limited
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Custom-Key': 'custom1' },
    });
    expect(res.status).toBe(429);

    // Request with different custom key passes
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Custom-Key': 'custom2' },
    });
    expect(res.status).toBe(200);
  });

  it('should handle Retry-After calculation correctly at different times in window', async () => {
    const windowMs = 60000;
    const limiter = createRateLimiter({
      windowMs,
      maxRequests: 1,
      keyExtractor: (c) => c.req.header('X-Pubkey') || 'default',
    });
    const app = new Hono();

    app.use(limiter);
    app.get('/test', (c) => c.json({ ok: true }));

    // First request at t=0
    vi.setSystemTime(new Date(0));
    await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });

    // Check Retry-After at t=10s (should be ~50s remaining)
    vi.setSystemTime(new Date(10000));
    let res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);
    let retryAfter = parseInt(res.headers.get('Retry-After')!, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(49);
    expect(retryAfter).toBeLessThanOrEqual(51);

    // Check Retry-After at t=50s (should be ~10s remaining)
    vi.setSystemTime(new Date(50000));
    res = await app.request('http://localhost/test', {
      method: 'GET',
      headers: { 'X-Pubkey': 'user1' },
    });
    expect(res.status).toBe(429);
    retryAfter = parseInt(res.headers.get('Retry-After')!, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(9);
    expect(retryAfter).toBeLessThanOrEqual(11);
  });
});
