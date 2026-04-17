import { randomBytes, randomInt } from 'node:crypto';
import { DESSERTS, FLAVORS, NUMBER_WORDS } from './wordlists.js';

const pick = <T>(arr: readonly T[]): T => {
  const idx = randomInt(0, arr.length);
  return arr[idx] as T;
};

// Roll a fresh random flavor + dessert combination. Callers register
// this base first; only on EEXIST do they disambiguate (see below).
export const baseName = (): string => `${pick(FLAVORS)}-${pick(DESSERTS)}`;

// Append a numbered-word disambiguator when a base has already been
// taken. n=0 returns the base unchanged. n=1 appends "Two" (i.e. this
// is the *second* agent of that flavor), n=2 → "Three", up to
// "Twenty". Beyond that the generator falls back to a 2-hex suffix so
// register's loop can never wedge.
export const disambiguate = (base: string, n: number): string => {
  if (n === 0) return base;
  if (n <= NUMBER_WORDS.length) return `${base}-${NUMBER_WORDS[n - 1]}`;
  return `${base}-${randomBytes(1).toString('hex')}`;
};
