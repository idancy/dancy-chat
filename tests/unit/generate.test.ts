import { describe, expect, test } from 'vitest';
import { nameCandidates } from '../../src/names/generate.js';
import { DESSERTS, FLAVORS, NUMBER_WORDS } from '../../src/names/wordlists.js';

const NAME_SHAPE = /^[A-Z][a-z]+(?:-[A-Z][a-z]+)*$/;

const take = (n: number): string[] => {
  const out: string[] = [];
  const gen = nameCandidates();
  for (let i = 0; i < n; i++) {
    const { value, done } = gen.next();
    if (done) break;
    out.push(value);
  }
  return out;
};

const all = (): string[] => Array.from(nameCandidates());

describe('nameCandidates', () => {
  test('every yielded name matches the CamelCase-hyphenated shape', () => {
    const sample = take(100);
    for (const name of sample) expect(name).toMatch(NAME_SHAPE);
  });

  test('tier 1: first DESSERTS.length yields are each a bare dessert, all unique', () => {
    const first = take(DESSERTS.length);
    expect(first).toHaveLength(DESSERTS.length);
    expect(new Set(first).size).toBe(DESSERTS.length);
    for (const n of first) {
      expect((DESSERTS as readonly string[]).includes(n)).toBe(true);
    }
    expect(new Set(first)).toEqual(new Set(DESSERTS));
  });

  test('tier 2: next FLAVORS*DESSERTS yields are unique flavor-dessert pairs', () => {
    const gen = nameCandidates();
    for (let i = 0; i < DESSERTS.length; i++) gen.next(); // skip tier 1
    const t2: string[] = [];
    const pairCount = FLAVORS.length * DESSERTS.length;
    for (let i = 0; i < pairCount; i++) t2.push(gen.next().value as string);

    expect(t2).toHaveLength(pairCount);
    expect(new Set(t2).size).toBe(pairCount);
    for (const name of t2) {
      const matched = FLAVORS.some((f) => {
        if (!name.startsWith(`${f}-`)) return false;
        const rest = name.slice(f.length + 1);
        return (DESSERTS as readonly string[]).includes(rest);
      });
      expect(matched, `not a flavor-dessert pair: ${name}`).toBe(true);
    }
  });

  test('tier 3: next FLAVORS*DESSERTS*NUMBER_WORDS yields are unique triples', () => {
    const gen = nameCandidates();
    const prelude = DESSERTS.length + FLAVORS.length * DESSERTS.length;
    for (let i = 0; i < prelude; i++) gen.next();

    const tripleCount = FLAVORS.length * DESSERTS.length * NUMBER_WORDS.length;
    const t3: string[] = [];
    for (let i = 0; i < tripleCount; i++) t3.push(gen.next().value as string);

    expect(t3).toHaveLength(tripleCount);
    expect(new Set(t3).size).toBe(tripleCount);
    for (const name of t3) {
      const endsInNumber = NUMBER_WORDS.some((n) => name.endsWith(`-${n}`));
      expect(endsInNumber, `triple should end with a number word: ${name}`).toBe(
        true,
      );
    }
  });

  test('generator terminates after all tiers (no infinite loop)', () => {
    const total =
      DESSERTS.length +
      FLAVORS.length * DESSERTS.length +
      FLAVORS.length * DESSERTS.length * NUMBER_WORDS.length;
    const drained = all();
    expect(drained).toHaveLength(total);
    // Entire namespace is unique across tiers too.
    expect(new Set(drained).size).toBe(total);
  });

  test('shuffle fairness: two fresh generators rarely produce identical tier-1 orderings', () => {
    // Tier 1 has ~19! orderings; two matching runs by chance is
    // astronomically unlikely. We run a few pairs to be safe.
    let anyDiffered = false;
    for (let k = 0; k < 5; k++) {
      const a = take(DESSERTS.length).join(',');
      const b = take(DESSERTS.length).join(',');
      if (a !== b) {
        anyDiffered = true;
        break;
      }
    }
    expect(anyDiffered).toBe(true);
  });
});

describe('wordlists', () => {
  test('FLAVORS and DESSERTS are non-empty with unique entries', () => {
    expect(FLAVORS.length).toBeGreaterThan(0);
    expect(DESSERTS.length).toBeGreaterThan(0);
    expect(new Set(FLAVORS).size).toBe(FLAVORS.length);
    expect(new Set(DESSERTS).size).toBe(DESSERTS.length);
  });

  test('NUMBER_WORDS covers Two through Twenty (19 entries)', () => {
    expect(NUMBER_WORDS.length).toBe(19);
    expect(NUMBER_WORDS[0]).toBe('Two');
    expect(NUMBER_WORDS[NUMBER_WORDS.length - 1]).toBe('Twenty');
    expect(new Set(NUMBER_WORDS).size).toBe(NUMBER_WORDS.length);
  });

  test('every wordlist entry is CamelCase, hyphenated if multi-word', () => {
    const token = /^[A-Z][a-z]+(?:-[A-Z][a-z]+)*$/;
    for (const f of FLAVORS) expect(f).toMatch(token);
    for (const d of DESSERTS) expect(d).toMatch(token);
    for (const w of NUMBER_WORDS) expect(w).toMatch(token);
  });
});
