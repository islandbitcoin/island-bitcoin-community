import { eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { users, balances, payouts } from '../db/schema';
import { randomUUID } from 'crypto';

type CreditGameType = 'trivia' | 'achievement' | 'referral';

const ensureUserAndBalanceTx = sqlite.transaction((pubkey: string) => {
  db.insert(users).values({ pubkey }).onConflictDoNothing().run();
  db.insert(balances)
    .values({
      userId: pubkey,
      balance: 0,
      pending: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      lastActivity: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();
});

const creditRewardTx = sqlite.transaction((pubkey: string, amount: number, gameType: string) => {
  db.insert(users).values({ pubkey }).onConflictDoNothing().run();
  db.insert(balances)
    .values({
      userId: pubkey,
      balance: 0,
      pending: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      lastActivity: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();

  const payoutId = randomUUID();
  db.insert(payouts)
    .values({
      id: payoutId,
      userId: pubkey,
      amount,
      gameType: gameType as 'trivia',
      status: 'paid',
      timestamp: new Date().toISOString(),
    })
    .run();

  // CRITICAL: atomic increment — do NOT refactor to read-then-write
  db.update(balances)
    .set({
      balance: sql`balance + ${amount}`,
      totalEarned: sql`total_earned + ${amount}`,
      lastActivity: new Date().toISOString(),
    })
    .where(eq(balances.userId, pubkey))
    .run();

  const row = db
    .select({ balance: balances.balance })
    .from(balances)
    .where(eq(balances.userId, pubkey))
    .get();

  return { payoutId, newBalance: row!.balance };
});

const debitBalanceTx = sqlite.transaction((pubkey: string, amount: number) => {
  const row = db
    .select({ balance: balances.balance })
    .from(balances)
    .where(eq(balances.userId, pubkey))
    .get();

  if (!row || row.balance < amount) {
    throw new Error('Insufficient balance');
  }

  const payoutId = randomUUID();
  db.insert(payouts)
    .values({
      id: payoutId,
      userId: pubkey,
      amount,
      gameType: 'withdrawal',
      status: 'pending',
      timestamp: new Date().toISOString(),
    })
    .run();

  // CRITICAL: atomic decrement — do NOT refactor to read-then-write
  db.update(balances)
    .set({
      balance: sql`balance - ${amount}`,
      pending: sql`pending + ${amount}`,
      totalWithdrawn: sql`total_withdrawn + ${amount}`,
      lastActivity: new Date().toISOString(),
    })
    .where(eq(balances.userId, pubkey))
    .run();

  const updated = db
    .select({ balance: balances.balance })
    .from(balances)
    .where(eq(balances.userId, pubkey))
    .get();

  return { payoutId, newBalance: updated!.balance };
});

const getBalanceTx = sqlite.transaction((pubkey: string) => {
  db.insert(users).values({ pubkey }).onConflictDoNothing().run();
  db.insert(balances)
    .values({
      userId: pubkey,
      balance: 0,
      pending: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      lastActivity: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();

  const row = db
    .select({ balance: balances.balance })
    .from(balances)
    .where(eq(balances.userId, pubkey))
    .get();

  return row!.balance;
});

export async function ensureUserAndBalance(pubkey: string): Promise<void> {
  return Promise.resolve(ensureUserAndBalanceTx(pubkey));
}

export async function creditReward(
  pubkey: string,
  amount: number,
  gameType: CreditGameType,
): Promise<{ payoutId: string; newBalance: number }> {
  return Promise.resolve(creditRewardTx(pubkey, amount, gameType));
}

export async function debitBalance(
  pubkey: string,
  amount: number,
): Promise<{ payoutId: string; newBalance: number }> {
  return Promise.resolve(debitBalanceTx(pubkey, amount));
}

export async function getBalance(pubkey: string): Promise<number> {
  return Promise.resolve(getBalanceTx(pubkey));
}
