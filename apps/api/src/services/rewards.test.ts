import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { users, balances, payouts } from '../db/schema';
import { creditReward, debitBalance, getBalance, ensureUserAndBalance } from './rewards';

describe('Rewards Service', () => {
  const testPubkey = 'rewards_test_pubkey_abc123';

  beforeEach(async () => {
    await db.delete(payouts);
    await db.delete(balances);
    await db.delete(users);
  });

  describe('ensureUserAndBalance', () => {
    it('creates user and balance if not exists', async () => {
      await ensureUserAndBalance(testPubkey);

      const balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, testPubkey),
      });

      expect(balance).toBeDefined();
      expect(balance!.balance).toBe(0);
      expect(balance!.totalEarned).toBe(0);
    });

    it('is idempotent — calling twice does not error', async () => {
      await ensureUserAndBalance(testPubkey);
      await ensureUserAndBalance(testPubkey);

      const balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, testPubkey),
      });

      expect(balance).toBeDefined();
      expect(balance!.balance).toBe(0);
    });
  });

  describe('getBalance', () => {
    it('returns 0 for new user (auto-creates)', async () => {
      const balance = await getBalance(testPubkey);
      expect(balance).toBe(0);
    });

    it('returns correct balance after credit', async () => {
      await creditReward(testPubkey, 10, 'trivia');
      const balance = await getBalance(testPubkey);
      expect(balance).toBe(10);
    });
  });

  describe('creditReward', () => {
    it('credits sats and returns payoutId + newBalance', async () => {
      const result = await creditReward(testPubkey, 5, 'trivia');

      expect(result.payoutId).toBeDefined();
      expect(result.payoutId).toHaveLength(36);
      expect(result.newBalance).toBe(5);
    });

    it('creates payout record with status paid', async () => {
      const result = await creditReward(testPubkey, 5, 'trivia');

      const payout = await db.query.payouts.findFirst({
        where: (p, { eq }) => eq(p.id, result.payoutId),
      });

      expect(payout).toBeDefined();
      expect(payout!.amount).toBe(5);
      expect(payout!.gameType).toBe('trivia');
      expect(payout!.status).toBe('paid');
    });

    it('accumulates balance across multiple credits', async () => {
      await creditReward(testPubkey, 5, 'trivia');
      const result = await creditReward(testPubkey, 10, 'achievement');

      expect(result.newBalance).toBe(15);

      const balance = await db.query.balances.findFirst({
        where: (b, { eq }) => eq(b.userId, testPubkey),
      });
      expect(balance!.totalEarned).toBe(15);
    });

    it('works for all game types', async () => {
      await creditReward(testPubkey, 1, 'trivia');
      await creditReward(testPubkey, 2, 'achievement');
      const result = await creditReward(testPubkey, 3, 'referral');

      expect(result.newBalance).toBe(6);
    });
  });

  describe('debitBalance', () => {
    it('debits sats for withdrawal', async () => {
      await creditReward(testPubkey, 100, 'trivia');
      const result = await debitBalance(testPubkey, 40);

      expect(result.payoutId).toBeDefined();
      expect(result.newBalance).toBe(60);
    });

    it('throws on insufficient balance', async () => {
      await creditReward(testPubkey, 10, 'trivia');

      await expect(debitBalance(testPubkey, 50)).rejects.toThrow('Insufficient balance');
    });

    it('creates withdrawal payout with pending status', async () => {
      await creditReward(testPubkey, 100, 'trivia');
      const result = await debitBalance(testPubkey, 30);

      const payout = await db.query.payouts.findFirst({
        where: (p, { eq }) => eq(p.id, result.payoutId),
      });

      expect(payout!.gameType).toBe('withdrawal');
      expect(payout!.status).toBe('pending');
      expect(payout!.amount).toBe(30);
    });
  });
});
