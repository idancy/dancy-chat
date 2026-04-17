import { randomBytes, randomInt } from 'node:crypto';
import { ADJECTIVES, NOUNS } from './wordlists.js';

const pick = <T>(arr: readonly T[]): T => {
  const idx = randomInt(0, arr.length);
  return arr[idx] as T;
};

const baseName = (): string => `${pick(ADJECTIVES)}-${pick(NOUNS)}`;

const suffixed = (base: string): string => {
  const hex = randomBytes(1).toString('hex');
  return `${base}-${hex}`;
};

// Produces a candidate name. After `collisionCount` collisions on the
// same base pool, falls back to a 2-hex suffix. After more than ~16
// collisions we keep extending the suffix to 4 hex chars. Callers are
// responsible for the `wx` race: we only produce candidates.
export const generateName = (collisionCount: number): string => {
  const base = baseName();
  if (collisionCount < 3) return base;
  if (collisionCount < 16) return suffixed(base);
  const hex = randomBytes(2).toString('hex');
  return `${base}-${hex}`;
};
