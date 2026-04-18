import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import chokidar from 'chokidar';
import { ensureDir, renameCAS } from '../fs/atomic.js';
import { readJsonSafe } from '../fs/json.js';
import { agentArchive, agentInbox } from '../fs/paths.js';
import {
  MessageRecord,
  type ReceiveMessagesInput,
  type ReceiveMessagesOutput,
} from '../schemas.js';

const DEFAULT_TIMEOUT_S = 60;
const DEBOUNCE_MS = 25;

const listPending = async (inbox: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(inbox, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
};

const claim = async (
  inbox: string,
  archive: string,
  filename: string,
): Promise<MessageRecord | null> => {
  const src = join(inbox, filename);
  const record = await readJsonSafe(src, MessageRecord);
  if (!record) return null;
  const won = await renameCAS(src, join(archive, filename));
  return won ? record : null;
};

const drain = async (inbox: string, archive: string): Promise<MessageRecord[]> => {
  const filenames = await listPending(inbox);
  const results = await Promise.all(filenames.map((fn) => claim(inbox, archive, fn)));
  return results.filter((m): m is MessageRecord => m !== null);
};

const waitForAdd = (
  inbox: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  return new Promise<void>((resolve) => {
    const watcher = chokidar.watch(inbox, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 20, pollInterval: 10 },
    });

    let settled = false;
    let debounce: NodeJS.Timeout | null = null;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (debounce) clearTimeout(debounce);
      clearTimeout(timeoutTimer);
      watcher.close().finally(() => resolve());
    };

    const timeoutTimer = setTimeout(finish, timeoutMs);

    watcher.on('add', (path) => {
      if (!path.endsWith('.json')) return;
      if (path.includes(`${inbox}/archive`)) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(finish, DEBOUNCE_MS);
    });

    // Close the TOCTOU gap between the caller's initial drain and the
    // watcher being armed: re-peek inbox once the watcher is ready.
    watcher.on('ready', async () => {
      try {
        const entries = await fs.readdir(inbox, { withFileTypes: true });
        const hasJson = entries.some((e) => e.isFile() && e.name.endsWith('.json'));
        if (hasJson) finish();
      } catch {
        // ENOENT handled by the caller's subsequent drain.
      }
    });

    signal?.addEventListener('abort', finish, { once: true });
  });
};

export const receiveMessages = async (
  input: ReceiveMessagesInput,
  signal?: AbortSignal,
): Promise<ReceiveMessagesOutput> => {
  const {
    project_key,
    agent_name,
    block = false,
    timeout_s = DEFAULT_TIMEOUT_S,
  } = input;
  const inbox = agentInbox(project_key, agent_name);
  const archive = agentArchive(project_key, agent_name);
  await ensureDir(inbox);
  await ensureDir(archive);

  const first = await drain(inbox, archive);
  if (!block || first.length > 0) {
    return { messages: first };
  }

  await waitForAdd(inbox, timeout_s * 1000, signal);

  // If the caller gave up (client cancellation, MCP request abort),
  // don't consume messages they won't receive. Leave the inbox intact
  // for the next live receive_messages call.
  if (signal?.aborted) {
    return { messages: [] };
  }

  const second = await drain(inbox, archive);
  return { messages: second };
};
