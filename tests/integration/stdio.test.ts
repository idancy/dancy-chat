import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const BIN_PATH = fileURLToPath(new URL('../../dist/bin.js', import.meta.url));

type ToolResult = {
  structuredContent?: unknown;
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

const structured = <T>(result: ToolResult): T => {
  if (result.structuredContent) return result.structuredContent as T;
  const text = result.content.find((c) => c.type === 'text')?.text ?? '';
  return JSON.parse(text) as T;
};

const makeClient = async (dir: string): Promise<{ client: Client; close: () => Promise<void> }> => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [BIN_PATH],
    env: { ...process.env, DANCY_CHAT_DIR: dir } as Record<string, string>,
    stderr: 'pipe',
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close();
      await transport.close();
    },
  };
};

describe('stdio integration', () => {
  let dir: string;
  const projectKey = '/tmp/integration-test-project';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dancy-chat-int-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('lists the six registered tools', async () => {
    const { client, close } = await makeClient(dir);
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name).sort();
      expect(names).toEqual([
        'acquire_lease',
        'list_agents',
        'receive_messages',
        'register',
        'release_lease',
        'send_message',
      ]);
    } finally {
      await close();
    }
  });

  test('register + list_agents round-trip', async () => {
    const { client, close } = await makeClient(dir);
    try {
      const registration = structured<{ name: string; slug: string }>(
        (await client.callTool({
          name: 'register',
          arguments: {
            project_key: projectKey,
            task_description: 'integration test agent',
          },
        })) as ToolResult,
      );
      expect(registration.name).toMatch(/^[a-z]+-[a-z]+/);

      const list = structured<{ slug: string; agents: Array<{ name: string }> }>(
        (await client.callTool({
          name: 'list_agents',
          arguments: { project_key: projectKey },
        })) as ToolResult,
      );
      expect(list.slug).toBe(registration.slug);
      expect(list.agents.map((a) => a.name)).toContain(registration.name);
    } finally {
      await close();
    }
  });

  test('send + receive across two clients', async () => {
    const aliceSession = await makeClient(dir);
    const bobSession = await makeClient(dir);
    try {
      const alice = structured<{ name: string }>(
        (await aliceSession.client.callTool({
          name: 'register',
          arguments: { project_key: projectKey, task_description: 'alice' },
        })) as ToolResult,
      );
      const bob = structured<{ name: string }>(
        (await bobSession.client.callTool({
          name: 'register',
          arguments: { project_key: projectKey, task_description: 'bob' },
        })) as ToolResult,
      );

      await aliceSession.client.callTool({
        name: 'send_message',
        arguments: {
          project_key: projectKey,
          from: alice.name,
          to: bob.name,
          subject: 'hello',
          body: 'from alice',
        },
      });

      const received = structured<{ messages: Array<{ from: string; subject: string }> }>(
        (await bobSession.client.callTool({
          name: 'receive_messages',
          arguments: { project_key: projectKey, agent_name: bob.name },
        })) as ToolResult,
      );
      expect(received.messages).toHaveLength(1);
      expect(received.messages[0]?.from).toBe(alice.name);
      expect(received.messages[0]?.subject).toBe('hello');
    } finally {
      await aliceSession.close();
      await bobSession.close();
    }
  });

  test('concurrent acquire_lease: exactly one wins', async () => {
    const sessions = await Promise.all(
      Array.from({ length: 5 }, () => makeClient(dir)),
    );
    try {
      const holders = await Promise.all(
        sessions.map((s, i) =>
          s.client
            .callTool({
              name: 'register',
              arguments: { project_key: projectKey, task_description: `agent-${i}` },
            })
            .then((r) => structured<{ name: string }>(r as ToolResult).name),
        ),
      );
      const results = await Promise.all(
        sessions.map((s, i) =>
          s.client
            .callTool({
              name: 'acquire_lease',
              arguments: {
                project_key: projectKey,
                name: 'ports/8080',
                holder: holders[i],
                ttl_s: 60,
              },
            })
            .then((r) => structured<{ acquired: boolean; holder: string }>(r as ToolResult)),
        ),
      );
      const winners = results.filter((r) => r.acquired);
      expect(winners).toHaveLength(1);
    } finally {
      await Promise.all(sessions.map((s) => s.close()));
    }
  });

  test('block=true unblocks when a message arrives', async () => {
    const aliceSession = await makeClient(dir);
    const bobSession = await makeClient(dir);
    try {
      const bob = structured<{ name: string }>(
        (await bobSession.client.callTool({
          name: 'register',
          arguments: { project_key: projectKey, task_description: 'bob' },
        })) as ToolResult,
      );
      const alice = structured<{ name: string }>(
        (await aliceSession.client.callTool({
          name: 'register',
          arguments: { project_key: projectKey, task_description: 'alice' },
        })) as ToolResult,
      );

      const started = Date.now();
      const receivePromise = bobSession.client.callTool({
        name: 'receive_messages',
        arguments: {
          project_key: projectKey,
          agent_name: bob.name,
          block: true,
          timeout_s: 5,
        },
      });
      await new Promise((r) => setTimeout(r, 100));
      await aliceSession.client.callTool({
        name: 'send_message',
        arguments: {
          project_key: projectKey,
          from: alice.name,
          to: bob.name,
          subject: 'wake',
          body: '',
        },
      });
      const received = structured<{ messages: Array<{ subject: string }> }>(
        (await receivePromise) as ToolResult,
      );
      const elapsed = Date.now() - started;
      expect(received.messages.map((m) => m.subject)).toEqual(['wake']);
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await aliceSession.close();
      await bobSession.close();
    }
  });
});
