import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addRegistration } from './lifecycle.js';
import {
  AcquireLeaseInput,
  ListAgentsInput,
  ReceiveMessagesInput,
  RegisterInput,
  ReleaseLeaseInput,
  SendMessageInput,
} from './schemas.js';
import { acquireLease } from './tools/acquireLease.js';
import { listAgents } from './tools/listAgents.js';
import { receiveMessages } from './tools/receiveMessages.js';
import { register } from './tools/register.js';
import { releaseLease } from './tools/releaseLease.js';
import { sendMessage } from './tools/sendMessage.js';

// Side-effecting wrapper: after a successful registration, remember
// it so the EOF shutdown handler can tear it down.
const trackedRegister = async (
  input: RegisterInput,
): Promise<{ name: string; slug: string }> => {
  const result = await register(input);
  addRegistration({ project_key: input.project_key, agent_name: result.name });
  return result;
};

const asToolResult = <T>(result: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: result as Record<string, unknown>,
});

const errorResult = (err: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: err instanceof Error ? err.message : String(err),
    },
  ],
  isError: true,
});

type HandlerExtra = { signal?: AbortSignal };

const wrap =
  <Input, Output>(
    handler: (input: Input, extra: HandlerExtra) => Promise<Output>,
  ) =>
  async (input: Input, extra: HandlerExtra) => {
    try {
      return asToolResult(await handler(input, extra));
    } catch (err) {
      return errorResult(err);
    }
  };

export const createServer = (): McpServer => {
  const server = new McpServer({
    name: 'dancy-chat',
    version: '0.1.0',
  });

  server.registerTool(
    'register',
    {
      title: 'Register agent',
      description:
        'Register a new agent in this project, or reconnect an existing session. Returns the agent name and project slug.',
      inputSchema: RegisterInput.shape,
    },
    wrap(trackedRegister),
  );

  server.registerTool(
    'send_message',
    {
      title: 'Send a message',
      description: 'Deliver a message to another registered agent in the same project.',
      inputSchema: SendMessageInput.shape,
    },
    wrap(sendMessage),
  );

  server.registerTool(
    'receive_messages',
    {
      title: 'Receive pending messages',
      description:
        'Return all pending messages for the calling agent and archive them. With block=true, hangs via filesystem watch until a message arrives or timeout_s elapses (default 60, max 600).',
      inputSchema: ReceiveMessagesInput.shape,
    },
    wrap(
      async (
        input: z.infer<typeof ReceiveMessagesInput>,
        extra: HandlerExtra,
      ) => await receiveMessages(input, extra.signal),
    ),
  );

  server.registerTool(
    'list_agents',
    {
      title: 'List registered agents',
      description:
        'Return agents currently registered in this project. Used for peer discovery (e.g. Lead ↔ Worker handshake).',
      inputSchema: ListAgentsInput.shape,
    },
    wrap(listAgents),
  );

  server.registerTool(
    'acquire_lease',
    {
      title: 'Acquire a named lease',
      description:
        'Claim an exclusive lease on a named resource (e.g. "ports/8080"). Returns { acquired, holder, expires_at }. Safe under concurrent contention.',
      inputSchema: AcquireLeaseInput.shape,
    },
    wrap(acquireLease),
  );

  server.registerTool(
    'release_lease',
    {
      title: 'Release a named lease',
      description:
        'Release a lease held by the given holder. No-op if the caller is not the current holder.',
      inputSchema: ReleaseLeaseInput.shape,
    },
    wrap(releaseLease),
  );

  return server;
};
