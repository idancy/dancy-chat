import { describe, expect, test } from 'vitest';
import { deriveSlug } from '../../src/util/slug.js';

describe('deriveSlug', () => {
  test('produces stem-hash format', () => {
    const slug = deriveSlug('/Users/thedancys/Documents/Code/money');
    expect(slug).toMatch(/^money-[0-9a-f]{6}$/);
  });

  test('is deterministic for the same path', () => {
    const a = deriveSlug('/tmp/foo');
    const b = deriveSlug('/tmp/foo');
    expect(a).toBe(b);
  });

  test('ignores trailing slashes', () => {
    const a = deriveSlug('/tmp/foo');
    const b = deriveSlug('/tmp/foo/');
    expect(a).toBe(b);
  });

  test('different paths produce different slugs', () => {
    const a = deriveSlug('/tmp/foo');
    const b = deriveSlug('/tmp/bar');
    expect(a).not.toBe(b);
  });

  test('same basename different parents still differ', () => {
    const a = deriveSlug('/tmp/a/money');
    const b = deriveSlug('/tmp/b/money');
    expect(a.startsWith('money-')).toBe(true);
    expect(b.startsWith('money-')).toBe(true);
    expect(a).not.toBe(b);
  });

  test('handles names with spaces and symbols', () => {
    const slug = deriveSlug('/tmp/Some Folder! (v2)');
    expect(slug).toMatch(/^some-folder-v2-[0-9a-f]{6}$/);
  });
});
