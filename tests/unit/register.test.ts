import { spawn } from 'node:child_process';
import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { register } from '../../src/tools/register.js';
import { listAgents } from '../../src/tools/listAgents.js';
import { agentFile } from '../../src/fs/paths.js';

describe('register', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-register-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-register-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('returns a readable CamelCase name', async () => {
    const result = await register({
      project_key: projectKey,
      task_description: 'test agent',
    });
    // Tier 1 yields a bare dessert; deeper tiers add hyphenated
    // segments. All shapes are CamelCase tokens joined by "-".
    expect(result.name).toMatch(/^[A-Z][a-z]+(?:-[A-Z][a-z]+)*$/);
    expect(result.slug).toBeTruthy();
  });

  test('re-registering in the same process returns the same name', async () => {
    const first = await register({
      project_key: projectKey,
      task_description: 'first time',
    });
    const second = await register({
      project_key: projectKey,
      task_description: 'reconnect',
    });
    expect(second.name).toBe(first.name);

    const listed = await listAgents({ project_key: projectKey });
    expect(listed.agents).toHaveLength(1);
    expect(listed.agents[0]?.task_description).toBe('reconnect');
  });

  test('list_agents does not expose pid', async () => {
    await register({
      project_key: projectKey,
      task_description: 'A',
    });
    const listed = await listAgents({ project_key: projectKey });
    for (const a of listed.agents) {
      expect(a).not.toHaveProperty('pid');
    }
  });

  test('stamps the server pid on the on-disk record', async () => {
    const { name } = await register({
      project_key: projectKey,
      task_description: 'pid-stamped',
    });
    const raw = await fs.readFile(agentFile(projectKey, name), 'utf8');
    const parsed = JSON.parse(raw) as { pid?: number };
    expect(parsed.pid).toBe(process.pid);
  });

  test('orphan from a dead pid is swept before a new register', async () => {
    // Simulate a prior server that registered and didn't clean up.
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
      stdio: 'ignore',
    });
    const deadPid = child.pid!;
    await new Promise<void>((resolve) => child.on('exit', () => resolve()));

    const orphanName = 'Ghost-Flan';
    const orphanPath = agentFile(projectKey, orphanName);
    await fs.mkdir(join(orphanPath, '..'), { recursive: true });
    const now = new Date().toISOString();
    await fs.writeFile(
      orphanPath,
      `${JSON.stringify(
        {
          name: orphanName,
          task_description: 'crashed earlier',
          registered_at: now,
          last_active: now,
          pid: deadPid,
        },
        null,
        2,
      )}\n`,
    );

    const { name } = await register({
      project_key: projectKey,
      task_description: 'fresh start',
    });
    expect(name).not.toBe(orphanName);

    await expect(fs.access(orphanPath)).rejects.toThrow();
    const listed = await listAgents({ project_key: projectKey });
    expect(listed.agents).toHaveLength(1);
    expect(listed.agents[0]?.name).toBe(name);
  });

});
