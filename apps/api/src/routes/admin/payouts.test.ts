import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { payoutsRoute } from './payouts';
import { db } from '../../db';
import { payouts, users, config } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools';
import * as flashService from '../../services/flash';

vi.mock('../../services/flash');

const TEST_SECRET_KEY = generateSecretKey();
const TEST_PUBKEY = getPublicKey(TEST_SECRET_KEY);

function createNIP98Event(url: string, method: string, secretKey: Uint8Array) {
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
    pubkey: getPublicKey(secretKey),
  };
  return finalizeEvent(event, secretKey);
}

function encodeAuthHeader(event: any): string {
  const eventJson = JSON.stringify(event);
  const base64Event = Buffer.from(eventJson).toString('base64');
  return `Nostr ${base64Event}`;
}

describe('Admin Payouts API', () => {
  let app: Hono;

  beforeEach(async () => {
    await db.delete(payouts);
    await db.delete(users);
    await db.delete(config);

    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([TEST_PUBKEY]),
    });

    await db.insert(config).values({
      key: 'ory_token',
      value: 'test-token-123',
    });

    app = new Hono();
    app.route('/admin/payouts', payoutsRoute);

    vi.clearAllMocks();
  });

  describe('POST /admin/payouts/process', () => {
    it('should require admin auth', async () => {
      const url = 'http://localhost/admin/payouts/process';
      const res = await app.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(401);
    });

    it('should process pending payouts', async () => {
      const user = await db.insert(users).values({
        pubkey: 'user123',
        lightningAddress: 'user@getalby.com',
      }).returning().get();

      await db.insert(payouts).values({
        id: 'payout1',
        userId: user.pubkey,
        amount: 50,
        gameType: 'trivia',
        status: 'pending',
      });

      vi.mocked(flashService.sendPayment).mockResolvedValue({
        success: true,
        paymentHash: 'hash123',
      });

      const url = 'http://localhost/admin/payouts/process';
      const authHeader = encodeAuthHeader(createNIP98Event(url, 'POST', TEST_SECRET_KEY));

      const res = await app.request(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(1);
      expect(body.succeeded).toBe(1);
      expect(body.failed).toBe(0);

      const updatedPayout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.id, 'payout1'),
      });
      expect(updatedPayout?.status).toBe('paid');
      expect(updatedPayout?.txId).toBe('hash123');
    });

    it('should handle auto-approve with threshold', async () => {
      const user = await db.insert(users).values({
        pubkey: 'user123',
        lightningAddress: 'user@getalby.com',
      }).returning().get();

      await db.insert(payouts).values([
        { id: 'payout1', userId: user.pubkey, amount: 50, gameType: 'trivia', status: 'pending' },
        { id: 'payout2', userId: user.pubkey, amount: 150, gameType: 'trivia', status: 'pending' },
      ]);

      vi.mocked(flashService.sendPayment).mockResolvedValue({
        success: true,
        paymentHash: 'hash123',
      });

      const url = 'http://localhost/admin/payouts/process';
      const authHeader = encodeAuthHeader(createNIP98Event(url, 'POST', TEST_SECRET_KEY));

      const res = await app.request(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoApprove: true, threshold: 100 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(1);
      expect(body.succeeded).toBe(1);

      const payout1 = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.id, 'payout1'),
      });
      expect(payout1?.status).toBe('paid');

      const payout2 = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.id, 'payout2'),
      });
      expect(payout2?.status).toBe('pending');
    });

    it('should handle missing Lightning Address', async () => {
      const user = await db.insert(users).values({
        pubkey: 'user123',
      }).returning().get();

      await db.insert(payouts).values({
        id: 'payout1',
        userId: user.pubkey,
        amount: 50,
        gameType: 'trivia',
        status: 'pending',
      });

      const url = 'http://localhost/admin/payouts/process';
      const authHeader = encodeAuthHeader(createNIP98Event(url, 'POST', TEST_SECRET_KEY));

      const res = await app.request(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(1);
      expect(body.failed).toBe(1);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.id, 'payout1'),
      });
      expect(payout?.status).toBe('failed');
    });

    it('should handle Flash API errors', async () => {
      const user = await db.insert(users).values({
        pubkey: 'user123',
        lightningAddress: 'user@getalby.com',
      }).returning().get();

      await db.insert(payouts).values({
        id: 'payout1',
        userId: user.pubkey,
        amount: 50,
        gameType: 'trivia',
        status: 'pending',
      });

      vi.mocked(flashService.sendPayment).mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });

      const url = 'http://localhost/admin/payouts/process';
      const authHeader = encodeAuthHeader(createNIP98Event(url, 'POST', TEST_SECRET_KEY));

      const res = await app.request(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(1);
      expect(body.failed).toBe(1);

      const payout = await db.query.payouts.findFirst({
        where: (payouts, { eq }) => eq(payouts.id, 'payout1'),
      });
      expect(payout?.status).toBe('failed');
    });

    it('should return error if ory_token not configured', async () => {
      await db.delete(config).where(eq(config.key, 'ory_token'));

      const url = 'http://localhost/admin/payouts/process';
      const authHeader = encodeAuthHeader(createNIP98Event(url, 'POST', TEST_SECRET_KEY));

      const res = await app.request(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('token not configured');
    });
  });
});
