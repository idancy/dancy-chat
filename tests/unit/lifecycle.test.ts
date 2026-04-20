import { spawn } from 'node:child_process';
import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addRegistration,
  clearRegistry,
  getRegistrations,
  isAlive,
  sweepOrphans,
  teardownAll,
  type Registration,
} from '../../src/lifecycle.js';
import { acquireLease } from '../../src/tools/acquireLease.js';
import { receiveMessages } from '../../src/tools/receiveMessages.js';
import { register } from '../../src/tools/register.js';
import { sendMessage } from '../../src/tools/sendMessage.js';
import { projectDir } from '../../src/config.js';
import { agentFile, agentInbox, leaseFile } from '../../src/fs/paths.js';

const spawnedDeadPid = async (): Promise<number> => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: 'ignore',
  });
  const pid = child.pid!;
  await new Promise<void>((resolve) => child.on('exit', () => resolve()));
  return pid;
};

const writeAgentFile = async (
  projectKey: string,
  record: {
    name: string;
    task_description: string;
    pid?: number;
  },
): Promise<void> => {
  const now = new Date().toISOString();
  const full = {
    name: record.name,
    task_description: record.task_description,
    registered_at: now,
    last_active: now,
    ...(record.pid != null ? { pid: record.pid } : {}),
  };
  const path = agentFile(projectKey, record.name);
  await fs.mkdir(join(path, '..'), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(full, null, 2)}\n`);
};

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
    // Under the one-agent-per-process invariant, only one of these is
    // `register()`; the co-tenant is written directly so both records
    // co-exist in the test fixture.
    const { name: alice } = await register({
      project_key: projectKey,
      task_description: 'alice',
    });
    const bob = 'Bob-Baklava';
    await writeAgentFile(projectKey, { name: bob, task_description: 'bob', pid: process.pid });
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
    const bob = 'Bob-Cannoli';
    await writeAgentFile(projectKey, { name: bob, task_description: 'bob', pid: process.pid });
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
    const bob = 'Bob-Danish';
    await writeAgentFile(projectKey, { name: bob, task_description: 'bob', pid: process.pid });

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

describe('sweepOrphans', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-sweep-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-sweep-'));
    process.env.DANCY_CHAT_DIR = dir;
    clearRegistry();
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    clearRegistry();
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('removes records whose pid is dead, preserves live ones', async () => {
    const deadPid = await spawnedDeadPid();
    await writeAgentFile(projectKey, {
      name: 'Orphan-Tiramisu',
      task_description: 'ghost',
      pid: deadPid,
    });
    await writeAgentFile(projectKey, {
      name: 'Live-Pavlova',
      task_description: 'kicking',
      pid: process.pid,
    });

    const removed = await sweepOrphans(projectKey);
    expect(removed).toEqual(['Orphan-Tiramisu']);
    await expect(
      fs.access(agentFile(projectKey, 'Orphan-Tiramisu')),
    ).rejects.toThrow();
    await fs.access(agentFile(projectKey, 'Live-Pavlova'));
  });

  test('releases leases held by swept orphans and removes their inbox', async () => {
    const deadPid = await spawnedDeadPid();
    await writeAgentFile(projectKey, {
      name: 'Sad-Eclair',
      task_description: 'gone',
      pid: deadPid,
    });
    await acquireLease({
      project_key: projectKey,
      name: 'resource/x',
      holder: 'Sad-Eclair',
      ttl_s: 60,
    });
    // Give Sad-Eclair an inbox entry.
    await fs.mkdir(agentInbox(projectKey, 'Sad-Eclair'), { recursive: true });
    await fs.writeFile(
      join(agentInbox(projectKey, 'Sad-Eclair'), 'msg.json'),
      '{}',
    );

    await sweepOrphans(projectKey);

    await expect(fs.access(leaseFile(projectKey, 'resource/x'))).rejects.toThrow();
    await expect(fs.access(agentInbox(projectKey, 'Sad-Eclair'))).rejects.toThrow();
  });

  test('treats a record without pid as orphan', async () => {
    await writeAgentFile(projectKey, {
      name: 'Nopid-Macaron',
      task_description: 'legacy',
    });
    const removed = await sweepOrphans(projectKey);
    expect(removed).toEqual(['Nopid-Macaron']);
  });

  test('preserves a record whose pid check returns EPERM', async () => {
    // A pid we don't own (like init) returns EPERM from signal 0 on
    // Unix. Simulate by stubbing process.kill to throw EPERM.
    await writeAgentFile(projectKey, {
      name: 'Privileged-Baklava',
      task_description: 'not ours',
      pid: 424242,
    });
    vi.spyOn(process, 'kill').mockImplementation(() => {
      const err: NodeJS.ErrnoException = new Error('permission denied');
      err.code = 'EPERM';
      throw err;
    });

    const removed = await sweepOrphans(projectKey);
    expect(removed).toEqual([]);
    await fs.access(agentFile(projectKey, 'Privileged-Baklava'));
  });

  test('isAlive: current pid is alive, spawned-exited pid is dead', async () => {
    expect(isAlive(process.pid)).toBe(true);
    const dead = await spawnedDeadPid();
    expect(isAlive(dead)).toBe(false);
  });
});
