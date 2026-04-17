import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { acquireLease } from '../../src/tools/acquireLease.js';
import { releaseLease } from '../../src/tools/releaseLease.js';

describe('lease', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-lease-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-lease-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('acquire succeeds on fresh name', async () => {
    const result = await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'alice',
      ttl_s: 60,
    });
    expect(result.acquired).toBe(true);
    expect(result.holder).toBe('alice');
  });

  test('second acquire is denied while lease is held', async () => {
    await acquireLease({ project_key: projectKey, name: 'ports/8080', holder: 'alice', ttl_s: 60 });
    const second = await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'bob',
      ttl_s: 60,
    });
    expect(second.acquired).toBe(false);
    expect(second.holder).toBe('alice');
  });

  test('concurrent acquires: exactly one wins', async () => {
    const attempts = 10;
    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        acquireLease({
          project_key: projectKey,
          name: 'ports/8080',
          holder: `agent-${i}`,
          ttl_s: 60,
        }),
      ),
    );
    const winners = results.filter((r) => r.acquired);
    expect(winners).toHaveLength(1);
    const winnerHolder = winners[0]?.holder;
    expect(winnerHolder).toMatch(/^agent-\d+$/);
    for (const r of results.filter((r) => !r.acquired)) {
      expect(r.holder).toBe(winnerHolder);
    }
  });

  test('expired lease can be reclaimed', async () => {
    await acquireLease({ project_key: projectKey, name: 'ports/8080', holder: 'alice', ttl_s: 1 });
    // Force expiry without waiting: directly rewrite the lease file with
    // an old expiry. In practice chokidar + TTL handles this; this is a
    // focused test.
    const leasePath = join(
      dir,
      'projects',
      // slug isn't predictable here; find the single project dir
    );
    const projects = await fs.readdir(join(dir, 'projects'));
    expect(projects).toHaveLength(1);
    const slug = projects[0]!;
    const file = join(dir, 'projects', slug, 'leases', 'ports_8080.json');
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    parsed.expires_at_ms = Date.now() - 1000;
    await fs.writeFile(file, JSON.stringify(parsed));

    const result = await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'bob',
      ttl_s: 60,
    });
    expect(result.acquired).toBe(true);
    expect(result.holder).toBe('bob');
  });

  test('release by holder removes the lease', async () => {
    await acquireLease({ project_key: projectKey, name: 'ports/8080', holder: 'alice', ttl_s: 60 });
    const released = await releaseLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'alice',
    });
    expect(released.released).toBe(true);

    const next = await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'bob',
      ttl_s: 60,
    });
    expect(next.acquired).toBe(true);
    expect(next.holder).toBe('bob');
  });

  test('release by non-holder is a no-op', async () => {
    await acquireLease({ project_key: projectKey, name: 'ports/8080', holder: 'alice', ttl_s: 60 });
    const released = await releaseLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'bob',
    });
    expect(released.released).toBe(false);

    // Alice still holds it
    const second = await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: 'charlie',
      ttl_s: 60,
    });
    expect(second.acquired).toBe(false);
    expect(second.holder).toBe('alice');
  });

  test('release on absent lease returns false', async () => {
    const released = await releaseLease({
      project_key: projectKey,
      name: 'never-held',
      holder: 'alice',
    });
    expect(released.released).toBe(false);
  });
});
