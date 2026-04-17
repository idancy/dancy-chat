import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { receiveMessages } from '../../src/tools/receiveMessages.js';
import { sendMessage } from '../../src/tools/sendMessage.js';

describe('send + receive', () => {
  let dir: string;
  const projectKey = '/tmp/fake-project-for-messaging-test';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-msg-'));
    process.env.DANCY_CHAT_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.DANCY_CHAT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('send then receive delivers the message', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'hi',
      body: 'hello bob',
    });
    const { messages } = await receiveMessages({
      project_key: projectKey,
      agent_name: 'bob',
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.from).toBe('alice');
    expect(messages[0]?.subject).toBe('hi');
    expect(messages[0]?.body).toBe('hello bob');
  });

  test('receive twice returns empty the second time (claim semantics)', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'once',
      body: '',
    });
    const first = await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    expect(first.messages).toHaveLength(1);
    const second = await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    expect(second.messages).toHaveLength(0);
  });

  test('bulk: 20 messages drained in one receive', async () => {
    for (let i = 0; i < 20; i++) {
      await sendMessage({
        project_key: projectKey,
        from: 'alice',
        to: 'bob',
        subject: `msg-${i}`,
        body: '',
      });
    }
    const { messages } = await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    expect(messages).toHaveLength(20);
    const subjects = messages.map((m) => m.subject).sort();
    expect(subjects).toEqual(
      Array.from({ length: 20 }, (_, i) => `msg-${i}`).sort(),
    );
  });

  test('messages delivered to different agents do not cross-contaminate', async () => {
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'for-bob',
      body: '',
    });
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'carol',
      subject: 'for-carol',
      body: '',
    });
    const bobInbox = await receiveMessages({ project_key: projectKey, agent_name: 'bob' });
    const carolInbox = await receiveMessages({ project_key: projectKey, agent_name: 'carol' });
    expect(bobInbox.messages.map((m) => m.subject)).toEqual(['for-bob']);
    expect(carolInbox.messages.map((m) => m.subject)).toEqual(['for-carol']);
  });

  test('block=true unblocks within ~100ms when a message arrives', async () => {
    const started = Date.now();
    const receivePromise = receiveMessages({
      project_key: projectKey,
      agent_name: 'bob',
      block: true,
      timeout_s: 5,
    });
    // Give the watcher time to arm before sending.
    await new Promise((r) => setTimeout(r, 50));
    await sendMessage({
      project_key: projectKey,
      from: 'alice',
      to: 'bob',
      subject: 'wake up',
      body: '',
    });
    const { messages } = await receivePromise;
    const elapsed = Date.now() - started;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.subject).toBe('wake up');
    expect(elapsed).toBeLessThan(1500);
  });

  test('block=true respects timeout and returns empty', async () => {
    const started = Date.now();
    const { messages } = await receiveMessages({
      project_key: projectKey,
      agent_name: 'bob',
      block: true,
      timeout_s: 1,
    });
    const elapsed = Date.now() - started;
    expect(messages).toHaveLength(0);
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(3000);
  });
});
