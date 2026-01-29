import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyExtractor?: (c: Context) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyExtractor } = options;
  const store = new Map<string, RateLimitEntry>();
  let requestCount = 0;

  const defaultKeyExtractor = (c: Context): string => {
    const pubkey = c.get('pubkey');
    if (!pubkey) {
      throw new HTTPException(401, { message: 'Authentication required for rate limiting' });
    }
    return pubkey;
  };

  const getKey = keyExtractor || defaultKeyExtractor;

  return async (c: Context, next: Next): Promise<void> => {
    const key = getKey(c);
    const now = Date.now();

    // Lazy cleanup: if entry exists and window expired, delete it
    const entry = store.get(key);
    if (entry && now > entry.resetAt) {
      store.delete(key);
    }

    // Get or create entry
    const current = store.get(key);
    if (!current) {
      // First request in window
      store.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    // Increment count
    current.count++;

    // Check if limit exceeded
    if (current.count > maxRequests) {
      const secondsRemaining = Math.ceil((current.resetAt - now) / 1000);
      const response = new Response('Too many requests', {
        status: 429,
        headers: { 'Retry-After': secondsRemaining.toString() },
      });
      throw new HTTPException(429, { res: response });
    }

    // Optional: prune expired entries if map is getting large
    requestCount++;
    if (requestCount % 100 === 0 && store.size > 1000) {
      const currentTime = Date.now();
      for (const [k, v] of store.entries()) {
        if (currentTime > v.resetAt) {
          store.delete(k);
        }
      }
    }

    await next();
  };
}
