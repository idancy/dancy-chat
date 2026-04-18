import { randomInt } from 'node:crypto';
import { DESSERTS, FLAVORS, NUMBER_WORDS } from './wordlists.js';

// Fisher-Yates shuffle, seeded from crypto.randomInt so every caller
// gets a fresh order. Non-mutating — returns a new array.
const shuffled = <T>(arr: readonly T[]): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

// Yield candidate agent names in order from shortest to longest,
// randomized within each tier. `register` iterates until O_EXCL
// write of agents/<name>.json succeeds; the filesystem decides
// availability, not us.
//
//   Tier 1: dessert alone            (e.g. "Sundae")
//   Tier 2: flavor-dessert           (e.g. "Vanilla-Eclair")
//   Tier 3: flavor-dessert-number    (e.g. "Vanilla-Eclair-Two")
//
// If every candidate across all three tiers is taken, the generator
// finishes without yielding more; `register` then throws.
export function* nameCandidates(): Generator<string> {
  for (const d of shuffled(DESSERTS)) yield d;

  const pairs: string[] = [];
  for (const f of FLAVORS) {
    for (const d of DESSERTS) pairs.push(`${f}-${d}`);
  }
  for (const p of shuffled(pairs)) yield p;

  const triples: string[] = [];
  for (const f of FLAVORS) {
    for (const d of DESSERTS) {
      for (const n of NUMBER_WORDS) triples.push(`${f}-${d}-${n}`);
    }
  }
  for (const t of shuffled(triples)) yield t;
}
