import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { tailMessages } from '../../src/fs/reader.js';
import { receiveMessages } from '../../src/tools/receiveMessages.js';
import { sendMessage } from '../../src/tools/sendMessage.js';

describe('tailMessages', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-reader-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-reader-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('returns empty when no messages dir exists', async () => {
    const observed = await tailMessages(projectKey, 100);
    expect(observed).toEqual([]);
  });

  test('tags a pending inbox message as unread', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'hi',
      body: '',
    });
    const observed = await tailMessages(projectKey, 100);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.status).toBe('unread');
    expect(observed[0]?.record.subject).toBe('hi');
  });

  test('tags an archived message as read', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'hi',
      body: '',
    });
    await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    const observed = await tailMessages(projectKey, 100);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.status).toBe('read');
  });

  test('merges pending + archived for the same agent, sorted chronologically', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'first',
      body: '',
    });
    await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'second',
      body: '',
    });
    const observed = await tailMessages(projectKey, 100);
    expect(observed.map((o) => o.record.subject)).toEqual(['first', 'second']);
    expect(observed.map((o) => o.status)).toEqual(['read', 'unread']);
  });

  test('limit slices across both inbox and archive', async () => {
    for (let i = 0; i < 3; i++) {
      await sendMessage({
        project_key: projectKey,
        from: 'alice',
        to: 'bob',
        subject: `archived-${i}`,
        body: '',
      });
    }
    await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    for (let i = 0; i < 3; i++) {
      await sendMessage({
        project_key: projectKey,
        from: 'alice',
        to: 'bob',
        subject: `pending-${i}`,
        body: '',
      });
    }
    const observed = await tailMessages(projectKey, 4);
    expect(observed).toHaveLength(4);
    // Newest 4 means 1 archived + 3 pending, in chronological order.
    expect(observed.map((o) => o.record.subject)).toEqual([
      'archived-2',
      'pending-0',
      'pending-1',
      'pending-2',
    ]);
    expect(observed.map((o) => o.status)).toEqual([
      'read',
      'unread',
      'unread',
      'unread',
    ]);
  });
});
