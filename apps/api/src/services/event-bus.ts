import { EventEmitter } from 'events';

export interface GameEvents {
  'trivia:correct': {
    pubkey: string;
    questionId: number;
    difficulty: string;
    streak: number;
    satsEarned: number;
  };
  'trivia:wrong': {
    pubkey: string;
    questionId: number;
    streak: number;
  };
  'trivia:level-up': {
    pubkey: string;
    newLevel: number;
  };
  'trivia:session-complete': {
    pubkey: string;
    sessionId: string;
    score: number;
    total: number;
  };
}

class TypedEventBus extends EventEmitter {
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof GameEvents>(
    event: K,
    listener: (payload: GameEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof GameEvents>(
    event: K,
    listener: (payload: GameEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }

  once<K extends keyof GameEvents>(
    event: K,
    listener: (payload: GameEvents[K]) => void
  ): this {
    return super.once(event, listener);
  }
}

export const gameEventBus = new TypedEventBus();
