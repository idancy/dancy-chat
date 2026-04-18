import { projectSlug } from '../config.js';
import { writeExclusive, writeThenRename } from '../fs/atomic.js';
import { agentFile } from '../fs/paths.js';
import { readAgents } from '../fs/reader.js';
import { sweepOrphans } from '../lifecycle.js';
import { nameCandidates } from '../names/generate.js';
import {
  AgentRecord,
  type RegisterInput,
  type RegisterOutput,
} from '../schemas.js';

const writeAgent = async (projectKey: string, record: AgentRecord): Promise<void> => {
  const json = `${JSON.stringify(record, null, 2)}\n`;
  await writeExclusive(agentFile(projectKey, record.name), json);
};

const refreshLastActive = async (
  projectKey: string,
  existing: AgentRecord,
  taskDescription: string,
): Promise<AgentRecord> => {
  const updated: AgentRecord = {
    ...existing,
    task_description: taskDescription,
    last_active: new Date().toISOString(),
    pid: process.pid,
  };
  await writeThenRename(
    agentFile(projectKey, existing.name),
    `${JSON.stringify(updated, null, 2)}\n`,
  );
  return updated;
};

export const register = async (input: RegisterInput): Promise<RegisterOutput> => {
  const { project_key, task_description, session_id } = input;
  const slug = projectSlug(project_key);

  // Clean up agent records left behind by prior servers that didn't
  // run teardown cleanly (Claude Code /compact, SIGKILL, crash).
  await sweepOrphans(project_key);

  if (session_id) {
    const existing = await readAgents(project_key);
    const match = existing.find((a) => a.session_id === session_id);
    if (match) {
      await refreshLastActive(project_key, match, task_description);
      return { name: match.name, slug };
    }
  }

  const now = new Date().toISOString();
  for (const name of nameCandidates()) {
    const record: AgentRecord = {
      name,
      task_description,
      session_id: session_id ?? null,
      registered_at: now,
      last_active: now,
      pid: process.pid,
    };
    try {
      await writeAgent(project_key, record);
      return { name, slug };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(
    'name space exhausted: all dessert/flavor combinations are taken',
  );
};
