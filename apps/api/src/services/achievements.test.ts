import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { users, achievements, achievementDefinitions, referrals, payouts, balances } from '../db/schema';
import { gameEventBus } from './event-bus';
import { initAchievements, resetAchievementEngine } from './achievements';

const testPubkey = 'test_achievement_engine_pubkey';

function seedTestDefinitions() {
  db.insert(achievementDefinitions).values([
    { type: 'first_correct', name: 'First Correct', description: 'Answer first question correctly', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } }, reward: 0 },
    { type: 'streak_5', name: '5 Streak', description: 'Get 5 correct in a row', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 5 } }, reward: 0 },
    { type: 'level_7', name: 'Easy Complete', description: 'Complete easy levels', criteria: { event: 'trivia:level-up', condition: { field: 'newLevel', operator: 'gte', value: 7 } }, reward: 0 },
  ]).run();
}

describe('Achievement Engine', () => {
  beforeEach(() => {
    gameEventBus.removeAllListeners();
    resetAchievementEngine();
    db.delete(achievements).run();
    db.delete(achievementDefinitions).run();
    db.delete(referrals).run();
    db.delete(payouts).run();
    db.delete(balances).run();
    db.delete(users).run();
    db.insert(users).values({ pubkey: testPubkey }).run();
  });

  afterEach(() => {
    gameEventBus.removeAllListeners();
    resetAchievementEngine();
  });

  it('should unlock achievement when event criteria met', () => {
    seedTestDefinitions();
    initAchievements();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 1,
      satsEarned: 10,
    });

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    expect(unlocked.length).toBe(1);
    expect(unlocked[0].achievementType).toBe('first_correct');
  });

  it('should unlock multiple achievements from single event', () => {
    seedTestDefinitions();
    initAchievements();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 5,
      satsEarned: 10,
    });

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    const types = unlocked.map((a) => a.achievementType).sort();
    expect(types).toEqual(['first_correct', 'streak_5']);
  });

  it('should not duplicate achievements (idempotent)', () => {
    seedTestDefinitions();
    initAchievements();

    const payload = {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 1,
      satsEarned: 10,
    };

    gameEventBus.emit('trivia:correct', payload);
    gameEventBus.emit('trivia:correct', payload);

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    expect(unlocked.length).toBe(1);
  });

  it('should not unlock when criteria not met', () => {
    seedTestDefinitions();
    initAchievements();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 0,
      satsEarned: 0,
    });

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    expect(unlocked.length).toBe(0);
  });

  it('should handle level-up event', () => {
    seedTestDefinitions();
    initAchievements();

    gameEventBus.emit('trivia:level-up', {
      pubkey: testPubkey,
      newLevel: 7,
    });

    const unlocked = db.select().from(achievements).all()
      .find(a => a.achievementType === 'level_7');

    expect(unlocked).toBeDefined();
    expect(unlocked!.userId).toBe(testPubkey);
  });

  it('should be idempotent on init (double init)', () => {
    seedTestDefinitions();
    initAchievements();
    initAchievements();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 1,
      satsEarned: 10,
    });

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    expect(unlocked.length).toBe(1);
  });

  it('should credit reward when definition has reward > 0', () => {
    db.insert(achievementDefinitions).values({
      type: 'rewarded_achievement',
      name: 'Rewarded',
      description: 'Has reward',
      criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } },
      reward: 50,
    }).run();

    initAchievements();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 1,
      satsEarned: 10,
    });

    const balance = db.select().from(balances).all()
      .find(b => b.userId === testPubkey);

    expect(balance).toBeDefined();
    expect(balance!.balance).toBe(50);
    expect(balance!.totalEarned).toBe(50);
  });

  it('should clean up listeners on reset', () => {
    seedTestDefinitions();
    initAchievements();
    resetAchievementEngine();

    gameEventBus.emit('trivia:correct', {
      pubkey: testPubkey,
      questionId: 1,
      difficulty: 'easy',
      streak: 1,
      satsEarned: 10,
    });

    const unlocked = db.select().from(achievements).all()
      .filter(a => a.userId === testPubkey);

    expect(unlocked.length).toBe(0);
  });
});
