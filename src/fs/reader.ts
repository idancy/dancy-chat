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

// Tail the most recent N messages across all agents, drawn from their
// archive directories. Sorted chronologically via ULID-sortable filenames.
export const tailMessages = async (
  projectKey: string,
  limit: number,
): Promise<Message[]> => {
  const msgDir = messagesDir(projectKey);
  let agentDirs: string[];
  try {
    const entries = await fs.readdir(msgDir, { withFileTypes: true });
    agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const allFiles: Array<{ path: string; filename: string }> = [];
  for (const agent of agentDirs) {
    const archiveDir = join(msgDir, agent, 'archive');
    const filenames = await jsonNames(archiveDir);
    for (const filename of filenames) {
      allFiles.push({ path: join(archiveDir, filename), filename });
    }
  }

  allFiles.sort((a, b) => a.filename.localeCompare(b.filename));
  const selected = allFiles.slice(-limit);

  const messages = await Promise.all(
    selected.map((f) => readJsonSafe(f.path, MessageRecord)),
  );
  return messages.filter((m): m is Message => m !== null);
};

// Helper for `list_agents` tool: scrubs session_id from output.
export const readAgentsPublic = async (
  projectKey: string,
): Promise<Array<Omit<Agent, 'session_id'>>> => {
  const agents = await readAgents(projectKey);
  return agents.map(({ session_id: _session_id, ...rest }) => rest);
};

// Exported for tests + debugging.
export const projectPath = (projectKey: string): string => projectDir(projectKey);
export const agentPath = (projectKey: string, name: string): string =>
  agentFile(projectKey, name);
export const leasePath = (projectKey: string, name: string): string =>
  leaseFile(projectKey, name);
