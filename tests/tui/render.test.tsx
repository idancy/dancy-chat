import { render } from 'ink-testing-library';
import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { App } from '../../src/tui/App.js';
import { register } from '../../src/tools/register.js';
import { sendMessage } from '../../src/tools/sendMessage.js';
import { acquireLease } from '../../src/tools/acquireLease.js';
import { receiveMessages } from '../../src/tools/receiveMessages.js';
import { agentFile } from '../../src/fs/paths.js';

// The register tool is now 1:1 with process.pid, so the second agent
// in these two-agent scenarios is written directly instead of via
// register().
const writeAgentFile = async (
  projectKey: string,
  name: string,
  taskDescription: string,
): Promise<void> => {
  const now = new Date().toISOString();
  const record = {
    name,
    task_description: taskDescription,
    registered_at: now,
    last_active: now,
    pid: process.pid,
  };
  const path = agentFile(projectKey, name);
  await fs.mkdir(join(path, '..'), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
};

describe('TUI App', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-tui-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-tui-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('renders header and empty state', async () => {
    const { lastFrame, unmount } = render(
      React.createElement(App, { projectKey }),
    );
    try {
      await new Promise((r) => setTimeout(r, 100));
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Dancy Chat');
      expect(frame).toContain('AGENTS');
      expect(frame).toContain('LEASES');
      expect(frame).toContain('MESSAGES');
      expect(frame).toContain('none registered');
      expect(frame).toContain('none held');
      expect(frame).toContain('no messages yet');
    } finally {
      unmount();
    }
  });

  test('renders live state after agents/messages/leases appear', async () => {
    const alice = await register({
      project_key: projectKey,
      task_description: 'alice the lead',
    });
    const bob = { name: 'Bob-Pavlova' };
    await writeAgentFile(projectKey, bob.name, 'bob the worker');
    await sendMessage({
      project_key: projectKey,
      from: alice.name,
      to: bob.name,
      subject: 'welcome',
      body: 'hi bob',
    });
    await receiveMessages({ project_key: projectKey, agent_name: bob.name });
    await acquireLease({
      project_key: projectKey,
      name: 'ports/8080',
      holder: alice.name,
      ttl_s: 60,
    });

    const { lastFrame, unmount } = render(
      React.createElement(App, { projectKey }),
    );
    try {
      await new Promise((r) => setTimeout(r, 300));
      const frame = lastFrame() ?? '';
      expect(frame).toContain(alice.name);
      expect(frame).toContain(bob.name);
      expect(frame).toContain('alice the lead');
      expect(frame).toContain('bob the worker');
      expect(frame).toContain('welcome');
      expect(frame).toContain('ports/8080');
      // Drained — no unread marker.
      expect(frame).not.toContain('●');
      // Age affordance: "<desc> · <N>s" on the description row.
      expect(frame).toMatch(/alice the lead · \d+s/);
      expect(frame).toMatch(/bob the worker · \d+s/);
    } finally {
      unmount();
    }
  });

  test('shows unread marker for messages still in the inbox', async () => {
    const alice = await register({
      project_key: projectKey,
      task_description: 'alice the lead',
    });
    const bob = { name: 'Bob-Tiramisu' };
    await writeAgentFile(projectKey, bob.name, 'bob the worker');
    await sendMessage({
      project_key: projectKey,
      from: alice.name,
      to: bob.name,
      subject: 'pending',
      body: 'still unread',
    });
    // No receiveMessages call — the message stays in bob's inbox.

    const { lastFrame, unmount } = render(
      React.createElement(App, { projectKey }),
    );
    try {
      await new Promise((r) => setTimeout(r, 300));
      const frame = lastFrame() ?? '';
      expect(frame).toContain('pending');
      expect(frame).toContain('●');
    } finally {
      unmount();
    }
  });
});
