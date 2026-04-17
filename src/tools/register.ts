import { projectSlug } from '../config.js';
import { writeExclusive, writeThenRename } from '../fs/atomic.js';
import { agentFile } from '../fs/paths.js';
import { readAgents } from '../fs/reader.js';
import { baseName, disambiguate } from '../names/generate.js';
import {
  AgentRecord,
  type RegisterInput,
  type RegisterOutput,
} from '../schemas.js';

const MAX_NAME_ATTEMPTS = 50;

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

  if (session_id) {
    const existing = await readAgents(project_key);
    const match = existing.find((a) => a.session_id === session_id);
    if (match) {
      await refreshLastActive(project_key, match, task_description);
      return { name: match.name, slug };
    }
  }

  const now = new Date().toISOString();
  const base = baseName();
  for (let n = 0; n < MAX_NAME_ATTEMPTS; n++) {
    const name = disambiguate(base, n);
    const record: AgentRecord = {
      name,
      task_description,
      session_id: session_id ?? null,
      registered_at: now,
      last_active: now,
    };
    try {
      await writeAgent(project_key, record);
      return { name, slug };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(
    `unable to generate a unique agent name after ${MAX_NAME_ATTEMPTS} attempts`,
  );
};
