import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  addRegistration,
  clearRegistry,
  getRegistrations,
  teardownAll,
  type Registration,
} from '../../src/lifecycle.js';
import { acquireLease } from '../../src/tools/acquireLease.js';
import { receiveMessages } from '../../src/tools/receiveMessages.js';
import { register } from '../../src/tools/register.js';
import { sendMessage } from '../../src/tools/sendMessage.js';
import { projectDir } from '../../src/config.js';
import { agentFile, agentInbox, leaseFile } from '../../src/fs/paths.js';

describe('teardownAll', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-lifecycle-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-life-'));
    process.env.DANCY_CHAT_DIR = dir;
    clearRegistry();
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    clearRegistry();
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('empty registrations: no-op', async () => {
    const result = await teardownAll([]);
    expect(result).toEqual({
      deleted_agents: [],
      released_leases: [],
      removed_message_dirs: [],
      removed_projects: [],
    });
  });

  test('single agent: deletes record, drops message dir, releases leases', async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: alice,
      ttl_s: 60,
    });
    await sendMessage({
      project_key: projectKey,
      from: 'system',
      to: alice,
      subject: 'hi',
      body: '',
    });
    await receiveMessages({ project_key: projectKey, agent_name: alice });

    const reg: Registration = { project_key: projectKey, agent_name: alice };
    const result = await teardownAll([reg]);

    expect(result.deleted_agents).toEqual([alice]);
    expect(result.released_leases).toEqual(['ports/8080']);
    expect(result.removed_message_dirs).toEqual([alice]);
    expect(result.removed_projects.length).toBe(1); // slug format

    await expect(fs.access(agentFile(projectKey, alice))).rejects.toThrow();
    await expect(fs.access(leaseFile(projectKey, 'ports/8080'))).rejects.toThrow();
    await expect(fs.access(agentInbox(projectKey, alice))).rejects.toThrow();
    await expect(fs.access(projectDir(projectKey))).rejects.toThrow();
  });

  test('other agents remain: project dir and their state preserved', async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const { name: bob } = await register({
      project_key: projectKey,
      task_description: 'bob',
    });
    await acquireLease({
      project_key: projectKey,
      name: 'bob-lease',
      holder: bob,
      ttl_s: 60,
    });

    await teardownAll([{ project_key: projectKey, agent_name: alice }]);

    // Alice is gone, Bob is intact.
    await expect(fs.access(agentFile(projectKey, alice))).rejects.toThrow();
    await fs.access(agentFile(projectKey, bob)); // not thrown
    await fs.access(leaseFile(projectKey, 'bob-lease'));
    await fs.access(projectDir(projectKey)); // project still exists
  });

  test("doesn't release a lease held by an agent we aren't tearing down", async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const { name: bob } = await register({
      project_key: projectKey,
      task_description: 'bob',
    });
    await acquireLease({
      project_key: projectKey,
      name: 'bobs-lease',
      holder: bob,
      ttl_s: 60,
    });

    // Only Alice tears down; Bob stays.
    await teardownAll([{ project_key: projectKey, agent_name: alice }]);

    // Bob's lease survives — we only sweep holder matches, and the
    // project dir isn't removed because Bob's agent record remains.
    await fs.access(leaseFile(projectKey, 'bobs-lease'));
  });

  test('last agent out removes the project dir', async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const { name: bob } = await register({
      project_key: projectKey,
      task_description: 'bob',
    });

    await teardownAll([
      { project_key: projectKey, agent_name: alice },
      { project_key: projectKey, agent_name: bob },
    ]);

    await expect(fs.access(projectDir(projectKey))).rejects.toThrow();
  });

  test('already-deleted agent: no throw, deleted_agents skips it', async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    await fs.unlink(agentFile(projectKey, alice));

    const result = await teardownAll([
      { project_key: projectKey, agent_name: alice },
    ]);
    expect(result.deleted_agents).toEqual([]);
    // project still ends up removed because agents/ is now empty
    expect(result.removed_projects.length).toBe(1);
  });

  test('parallel teardowns: both succeed, fs end state clean', async () => {
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });

    const regs: Registration[] = [
      { project_key: projectKey, agent_name: alice },
    ];
    const [a, b] = await Promise.all([teardownAll(regs), teardownAll(regs)]);
    // At least one of them should report deletion; both should return.
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    await expect(fs.access(projectDir(projectKey))).rejects.toThrow();
  });

  test('registry add/get/clear round-trip', () => {
    addRegistration({ project_key: '/p1', agent_name: 'Alice' });
    addRegistration({ project_key: '/p1', agent_name: 'Bob' });
    addRegistration({ project_key: '/p1', agent_name: 'Alice' }); // dup

    const regs = getRegistrations();
    expect(regs).toHaveLength(2);
    const names = regs.map((r) => r.agent_name).sort();
    expect(names).toEqual(['Alice', 'Bob']);

    clearRegistry();
    expect(getRegistrations()).toHaveLength(0);
  });
});
