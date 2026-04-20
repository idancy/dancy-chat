import { projectSlug } from '../config.js';
import { readAgents } from '../fs/reader.js';
import { type ListAgentsInput, type ListAgentsOutput } from '../schemas.js';

export const listAgents = async (input: ListAgentsInput): Promise<ListAgentsOutput> => {
  const { project_key } = input;
  const slug = projectSlug(project_key);
  const records = await readAgents(project_key);
  const agents = records.map(({ name, task_description, registered_at, last_active }) => ({
    name,
    task_description,
    registered_at,
    last_active,
  }));
  return { slug, agents };
};
