import type { IsoTimestamp, Uuid } from './types.js';

/**
 * Time and identity are injected, never read from globals directly, so the
 * orchestrator and entities stay deterministic under test.
 */
export interface Clock {
  now(): IsoTimestamp;
}

export interface IdGenerator {
  next(): Uuid;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export const randomIdGenerator: IdGenerator = {
  next: () => crypto.randomUUID(),
};
