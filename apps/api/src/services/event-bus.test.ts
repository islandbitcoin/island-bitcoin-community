import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameEventBus } from './event-bus';

describe('Event Bus', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    gameEventBus.removeAllListeners();
  });

  it('should emit and trigger registered listener', () => {
    const listener = vi.fn();
    gameEventBus.on('trivia:correct', listener);

    const payload = {
      pubkey: 'test-pubkey',
      questionId: 1,
      difficulty: 'easy',
      streak: 5,
      satsEarned: 10,
    };

    gameEventBus.emit('trivia:correct', payload);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should support multiple listeners for same event', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    gameEventBus.on('trivia:wrong', listener1);
    gameEventBus.on('trivia:wrong', listener2);

    const payload = {
      pubkey: 'test-pubkey',
      questionId: 2,
      streak: 0,
    };

    gameEventBus.emit('trivia:wrong', payload);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener1).toHaveBeenCalledWith(payload);
    expect(listener2).toHaveBeenCalledWith(payload);
  });

  it('should pass correct payload shape for trivia:level-up', () => {
    const listener = vi.fn();
    gameEventBus.on('trivia:level-up', listener);

    const payload = {
      pubkey: 'test-pubkey',
      newLevel: 2,
    };

    gameEventBus.emit('trivia:level-up', payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should pass correct payload shape for trivia:session-complete', () => {
    const listener = vi.fn();
    gameEventBus.on('trivia:session-complete', listener);

    const payload = {
      pubkey: 'test-pubkey',
      sessionId: 'session-123',
      score: 4,
      total: 5,
    };

    gameEventBus.emit('trivia:session-complete', payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should not throw when emitting unregistered events', () => {
    expect(() => {
      gameEventBus.emit('trivia:correct', {
        pubkey: 'test-pubkey',
        questionId: 1,
        difficulty: 'easy',
        streak: 0,
        satsEarned: 5,
      });
    }).not.toThrow();
  });

  it('should allow removing listeners', () => {
    const listener = vi.fn();
    gameEventBus.on('trivia:correct', listener);
    gameEventBus.off('trivia:correct', listener);

    gameEventBus.emit('trivia:correct', {
      pubkey: 'test-pubkey',
      questionId: 1,
      difficulty: 'easy',
      streak: 0,
      satsEarned: 5,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
