import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { projectSlug } from './config.js';
import { unlinkIfExists } from './fs/atomic.js';
import { readJsonSafe } from './fs/json.js';
import { agentFile, agentInbox, agentsDir, leasesDir } from './fs/paths.js';
import { projectDir } from './config.js';
import { LeaseRecord } from './schemas.js';

export type Registration = {
  project_key: string;
  agent_name: string;
};

export type TeardownResult = {
  deleted_agents: string[];
  released_leases: string[];
  removed_message_dirs: string[];
  removed_projects: string[];
};

// Module-scoped registry of agents this process has registered. The
// register tool appends on successful registration; teardownAll reads
// it on shutdown. Deduped by (project_key, agent_name).
const registry = new Map<string, Registration>();
const regKey = (r: Registration): string => `${r.project_key}|${r.agent_name}`;

export const addRegistration = (r: Registration): void => {
  registry.set(regKey(r), r);
};

export const getRegistrations = (): Registration[] =>
  Array.from(registry.values());

export const clearRegistry = (): void => {
  registry.clear();
};

const releaseAgentLeases = async (
  projectKey: string,
  agentName: string,
): Promise<string[]> => {
  const dir = leasesDir(projectKey);
  let filenames: string[];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    filenames = entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const released: string[] = [];
  for (const fn of filenames) {
    const path = join(dir, fn);
    const record = await readJsonSafe(path, LeaseRecord);
    if (!record || record.holder !== agentName) continue;
    if (await unlinkIfExists(path)) released.push(record.name);
  }
  return released;
};

const removeAgentMessages = async (
  projectKey: string,
  agentName: string,
): Promise<boolean> => {
  const dir = agentInbox(projectKey, agentName);
  try {
    await fs.access(dir);
  } catch {
    return false;
  }
  await fs.rm(dir, { recursive: true, force: true });
  return true;
};

const agentsDirIsEmpty = async (projectKey: string): Promise<boolean> => {
  try {
    const entries = await fs.readdir(agentsDir(projectKey));
    return entries.filter((e) => e.endsWith('.json')).length === 0;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw err;
  }
};

// Tear down every registration in the given iterable. For each agent:
// release held leases, delete the agent record, remove its message
// dir. Then, for each unique project, if agents/ is empty the entire
// project dir is removed. Safe to call from multiple processes in
// parallel (uses `force: true` on destructive ops).
export const teardownAll = async (
  registrations: Iterable<Registration> = registry.values(),
): Promise<TeardownResult> => {
  const regs = Array.from(registrations);
  const result: TeardownResult = {
    deleted_agents: [],
    released_leases: [],
    removed_message_dirs: [],
    removed_projects: [],
  };

  for (const r of regs) {
    const releasedHere = await releaseAgentLeases(r.project_key, r.agent_name);
    result.released_leases.push(...releasedHere);

    if (await unlinkIfExists(agentFile(r.project_key, r.agent_name))) {
      result.deleted_agents.push(r.agent_name);
    }

    if (await removeAgentMessages(r.project_key, r.agent_name)) {
      result.removed_message_dirs.push(r.agent_name);
    }
  }

  const uniqueProjects = Array.from(new Set(regs.map((r) => r.project_key)));
  for (const pk of uniqueProjects) {
    if (await agentsDirIsEmpty(pk)) {
      await fs.rm(projectDir(pk), { recursive: true, force: true });
      result.removed_projects.push(projectSlug(pk));
    }
  }

  return result;
};
