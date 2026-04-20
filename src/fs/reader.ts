import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { projectDir } from '../config.js';
import {
  AgentRecord,
  LeaseRecord,
  MessageRecord,
  type AgentRecord as Agent,
  type LeaseRecord as Lease,
  type MessageRecord as Message,
} from '../schemas.js';
import { agentFile, agentsDir, leaseFile, leasesDir, messagesDir } from './paths.js';
import { readJsonSafe } from './json.js';

const jsonNames = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
};

export const readAgents = async (projectKey: string): Promise<Agent[]> => {
  const dir = agentsDir(projectKey);
  const names = await jsonNames(dir);
  const records = await Promise.all(
    names.map((n) => readJsonSafe(join(dir, n), AgentRecord)),
  );
  return records.filter((r): r is Agent => r !== null);
};

export type NamedLease = { name: string; record: Lease };

export const readLeases = async (projectKey: string): Promise<NamedLease[]> => {
  const dir = leasesDir(projectKey);
  const filenames = await jsonNames(dir);
  const results = await Promise.all(
    filenames.map((fn) => readJsonSafe(join(dir, fn), LeaseRecord)),
  );
  return results
    .filter((r): r is Lease => r !== null)
    .map((record) => ({ name: record.name, record }));
};

// TUI-facing view of a message: the on-disk record plus a derived
// read/unread status based on which directory the file was found in.
// Unread = still in the per-agent inbox; read = moved to archive by a
// prior receive_messages drain.
export type ObservedMessage = {
  record: Message;
  status: 'unread' | 'read';
};

// Tail the most recent N messages across all agents, drawn from both
// the pending inbox (unread) and the archive (read). Sorted
// chronologically via ULID-sortable filenames, independent of status.
export const tailMessages = async (
  projectKey: string,
  limit: number,
): Promise<ObservedMessage[]> => {
  const msgDir = messagesDir(projectKey);
  let agentDirs: string[];
  try {
    const entries = await fs.readdir(msgDir, { withFileTypes: true });
    agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const allFiles: Array<{
    path: string;
    filename: string;
    status: 'unread' | 'read';
  }> = [];
  for (const agent of agentDirs) {
    const inboxDir = join(msgDir, agent);
    const archiveDir = join(inboxDir, 'archive');
    // jsonNames filters to *.json files, so the archive/ subdir is
    // skipped naturally when enumerating the inbox top level.
    const [pending, archived] = await Promise.all([
      jsonNames(inboxDir),
      jsonNames(archiveDir),
    ]);
    for (const filename of pending) {
      allFiles.push({ path: join(inboxDir, filename), filename, status: 'unread' });
    }
    for (const filename of archived) {
      allFiles.push({ path: join(archiveDir, filename), filename, status: 'read' });
    }
  }

  allFiles.sort((a, b) => a.filename.localeCompare(b.filename));
  const selected = allFiles.slice(-limit);

  const observed = await Promise.all(
    selected.map(async (f) => {
      const record = await readJsonSafe(f.path, MessageRecord);
      return record ? { record, status: f.status } : null;
    }),
  );
  return observed.filter((o): o is ObservedMessage => o !== null);
};

// Exported for tests + debugging.
export const projectPath = (projectKey: string): string => projectDir(projectKey);
export const agentPath = (projectKey: string, name: string): string =>
  agentFile(projectKey, name);
export const leasePath = (projectKey: string, name: string): string =>
  leaseFile(projectKey, name);
