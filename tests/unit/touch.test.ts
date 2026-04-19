import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { register } from '../../src/tools/register.js';
import { touchAgent } from '../../src/tools/touchAgent.js';
import { readAgents } from '../../src/fs/reader.js';
import { agentFile } from '../../src/fs/paths.js';

describe('touchAgent', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-touch-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-touch-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('bumps last_active past registered_at for a registered agent', async () => {
    const { name } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const [before] = await readAgents(projectKey);
    expect(before).toBeDefined();
    // Small gap so ISO strings compare strictly greater.
    await new Promise((r) => setTimeout(r, 10));
    await touchAgent(projectKey, name);
    const [after] = await readAgents(projectKey);
    expect(after).toBeDefined();
    expect(after!.last_active > before!.last_active).toBe(true);
    expect(after!.registered_at).toBe(before!.registered_at);
    expect(after!.name).toBe(before!.name);
  });

  test('is a no-op when the agent is not registered', async () => {
    await touchAgent(projectKey, 'ghost-agent');
    // Must not have created the file.
    await expect(fs.stat(agentFile(projectKey, 'ghost-agent'))).rejects.toThrow(
      /ENOENT/,
    );
  });

  test('concurrent touches leave a valid, updated record', async () => {
    const { name } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const [before] = await readAgents(projectKey);
    await new Promise((r) => setTimeout(r, 10));
    await Promise.all(
      Array.from({ length: 20 }, () => touchAgent(projectKey, name)),
    );
    const [after] = await readAgents(projectKey);
    expect(after).toBeDefined();
    expect(after!.last_active > before!.last_active).toBe(true);
    // File is valid JSON with all required fields.
    const raw = await fs.readFile(agentFile(projectKey, name), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
