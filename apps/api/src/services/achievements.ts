import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { achievements, achievementDefinitions, users } from '../db/schema';
import type { AchievementDefinition } from '../db/schema';
import { gameEventBus, type GameEvents } from './event-bus';
import { creditReward } from './rewards';

let initialized = false;
let cachedDefinitions: AchievementDefinition[] = [];
const registeredListeners: Array<{ event: string; handler: (payload: unknown) => void }> = [];

export function initAchievements(): void {
  if (initialized) return;

  cachedDefinitions = db
    .select()
    .from(achievementDefinitions)
    .where(eq(achievementDefinitions.active, true))
    .all();

  for (const def of cachedDefinitions) {
    const event = def.criteria.event as keyof GameEvents;
    const handler = (payload: unknown) => {
      processAchievement(def, payload as Record<string, unknown>);
    };
    gameEventBus.on(event, handler);
    registeredListeners.push({ event, handler });
  }

  initialized = true;
}

export function processAchievement(
  def: AchievementDefinition,
  payload: Record<string, unknown>,
): void {
  const { condition } = def.criteria;
  const fieldValue = payload[condition.field];

  if (typeof fieldValue !== 'number') return;

  let met = false;
  if (condition.operator === 'gte') {
    met = fieldValue >= condition.value;
  } else if (condition.operator === 'eq') {
    met = fieldValue === condition.value;
  }

  if (!met) return;

  const pubkey = payload['pubkey'] as string;
  if (!pubkey) return;

  const existing = db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, pubkey))
    .all()
    .find((a) => a.achievementType === def.type);

  if (existing) return;

  try {
    sqlite.transaction(() => {
      db.insert(users).values({ pubkey }).onConflictDoNothing().run();
      db.insert(achievements)
        .values({ userId: pubkey, achievementType: def.type })
        .run();
    })();
  } catch {
    return;
  }

  if (def.reward > 0) {
    creditReward(pubkey, def.reward, 'achievement').catch(() => {});
  }
}

export function resetAchievementEngine(): void {
  for (const { event, handler } of registeredListeners) {
    gameEventBus.off(event as keyof GameEvents, handler as never);
  }
  registeredListeners.length = 0;
  cachedDefinitions = [];
  initialized = false;
}

export function getDefinitions(): AchievementDefinition[] {
  return cachedDefinitions;
}
