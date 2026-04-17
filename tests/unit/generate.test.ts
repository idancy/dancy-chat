import { describe, expect, test } from 'vitest';
import { generateName } from '../../src/names/generate.js';
import { ADJECTIVES, NOUNS } from '../../src/names/wordlists.js';

describe('generateName', () => {
  test('produces adjective-noun with no suffix before 3 collisions', () => {
    for (let i = 0; i < 2; i++) {
      const name = generateName(i);
      const [adj, noun, extra] = name.split('-');
      expect(extra).toBeUndefined();
      expect(ADJECTIVES).toContain(adj);
      expect(NOUNS).toContain(noun);
    }
  });

  test('appends 2-hex suffix at 3+ collisions', () => {
    const name = generateName(5);
    const parts = name.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[2]).toMatch(/^[0-9a-f]{2}$/);
  });

  test('extends to 4-hex suffix at 16+ collisions', () => {
    const name = generateName(20);
    const parts = name.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[2]).toMatch(/^[0-9a-f]{4}$/);
  });

  test('produces varied names across many calls', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) names.add(generateName(0));
    expect(names.size).toBeGreaterThan(40);
  });

  test('wordlists have expected shape', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(50);
    expect(NOUNS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length);
    expect(new Set(NOUNS).size).toBe(NOUNS.length);
  });
});
