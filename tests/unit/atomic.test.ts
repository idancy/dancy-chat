import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  renameCAS,
  unlinkIfExists,
  writeExclusive,
  writeThenRename,
} from '../../src/fs/atomic.js';

describe('atomic', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-atomic-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('writeExclusive', () => {
    test('creates a new file', async () => {
      const path = join(dir, 'new.json');
      await writeExclusive(path, '{"ok":true}');
      const content = await fs.readFile(path, 'utf8');
      expect(content).toBe('{"ok":true}');
    });

    test('creates nested directories', async () => {
      const path = join(dir, 'a', 'b', 'c', 'new.json');
      await writeExclusive(path, 'x');
      const content = await fs.readFile(path, 'utf8');
      expect(content).toBe('x');
    });

    test('throws EEXIST when file already exists', async () => {
      const path = join(dir, 'exists.json');
      await writeExclusive(path, 'first');
      await expect(writeExclusive(path, 'second')).rejects.toMatchObject({
        code: 'EEXIST',
      });
    });

    test('first writer wins under concurrent creation', async () => {
      const path = join(dir, 'race.json');
      const attempts = 20;
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, (_, i) => writeExclusive(path, `writer-${i}`)),
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(attempts - 1);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason.code).toBe('EEXIST');
      }
    });
  });

  describe('writeThenRename', () => {
    test('overwrites existing file atomically', async () => {
      const path = join(dir, 'over.json');
      await writeExclusive(path, 'first');
      await writeThenRename(path, 'second');
      expect(await fs.readFile(path, 'utf8')).toBe('second');
    });

    test('creates file if absent', async () => {
      const path = join(dir, 'fresh.json');
      await writeThenRename(path, 'hi');
      expect(await fs.readFile(path, 'utf8')).toBe('hi');
    });

    test('cleans up tmp files on success', async () => {
      const path = join(dir, 'clean.json');
      await writeThenRename(path, 'x');
      const entries = await fs.readdir(dir);
      expect(entries.filter((e) => e.includes('.tmp.'))).toEqual([]);
    });
  });

  describe('renameCAS', () => {
    test('returns true on successful rename', async () => {
      const src = join(dir, 'src.json');
      const dst = join(dir, 'dst.json');
      await writeExclusive(src, 'x');
      expect(await renameCAS(src, dst)).toBe(true);
      expect(await fs.readFile(dst, 'utf8')).toBe('x');
    });

    test('returns false when source is missing', async () => {
      const src = join(dir, 'missing.json');
      const dst = join(dir, 'dst.json');
      expect(await renameCAS(src, dst)).toBe(false);
    });

    test('exactly one racer wins when renaming shared source', async () => {
      const src = join(dir, 'shared.json');
      await writeExclusive(src, 'contents');
      const dsts = Array.from({ length: 10 }, (_, i) => join(dir, `dst-${i}.json`));
      const results = await Promise.all(dsts.map((dst) => renameCAS(src, dst)));
      expect(results.filter((r) => r === true)).toHaveLength(1);
      expect(results.filter((r) => r === false)).toHaveLength(9);
    });
  });

  describe('unlinkIfExists', () => {
    test('returns true when file removed', async () => {
      const path = join(dir, 'x.json');
      await writeExclusive(path, 'x');
      expect(await unlinkIfExists(path)).toBe(true);
    });

    test('returns false when file absent', async () => {
      expect(await unlinkIfExists(join(dir, 'never.json'))).toBe(false);
    });
  });
});
