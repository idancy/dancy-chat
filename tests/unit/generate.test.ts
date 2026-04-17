import { describe, expect, test } from 'vitest';
import { baseName, disambiguate } from '../../src/names/generate.js';
import {
  DESSERTS,
  FLAVORS,
  NUMBER_WORDS,
} from '../../src/names/wordlists.js';

// Accepts any hyphenated run of CamelCase tokens, with an optional
// suffix at the end (either a numbered word or a 2-hex fallback).
const NAME_SHAPE = /^[A-Z][a-z]+(?:-[A-Z][a-z]+)+(?:-(?:[A-Z][a-z]+|[0-9a-f]{2}))?$/;

describe('baseName', () => {
  test('always returns `${flavor}-${dessert}` with both from the wordlists', () => {
    for (let i = 0; i < 20; i++) {
      const name = baseName();
      expect(name).toMatch(NAME_SHAPE);
      // Every generated base must decompose into a known flavor + dessert.
      const matched = FLAVORS.some((f) => {
        if (!name.startsWith(`${f}-`)) return false;
        const rest = name.slice(f.length + 1);
        return (DESSERTS as readonly string[]).includes(rest);
      });
      expect(matched, `unexpected base name: ${name}`).toBe(true);
    }
  });

  test('produces varied names across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(baseName());
    // With 12 × 9 = 108 combos, 200 rolls should hit a wide spread.
    expect(seen.size).toBeGreaterThan(30);
  });
});

describe('disambiguate', () => {
  const BASE = 'Chocolate-Sundae';

  test('n=0 returns the base unchanged', () => {
    expect(disambiguate(BASE, 0)).toBe(BASE);
  });

  test('appends Two at n=1, Three at n=2, ... Twenty at n=19', () => {
    expect(disambiguate(BASE, 1)).toBe('Chocolate-Sundae-Two');
    expect(disambiguate(BASE, 2)).toBe('Chocolate-Sundae-Three');
    expect(disambiguate(BASE, 19)).toBe('Chocolate-Sundae-Twenty');
  });

  test('falls back to a 2-hex suffix beyond the numbered range', () => {
    const name = disambiguate(BASE, 20);
    expect(name).toMatch(/^Chocolate-Sundae-[0-9a-f]{2}$/);
  });

  test('output always matches the canonical name shape', () => {
    const long = 'Java-Chip-Ice-Cream-Cake';
    expect(disambiguate(long, 0)).toMatch(NAME_SHAPE);
    expect(disambiguate(long, 5)).toMatch(NAME_SHAPE);
    expect(disambiguate(long, 25)).toMatch(NAME_SHAPE);
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
