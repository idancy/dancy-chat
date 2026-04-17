import { projectSlug } from '../config.js';
import { readAgentsPublic } from '../fs/reader.js';
import { type ListAgentsInput, type ListAgentsOutput } from '../schemas.js';

export const listAgents = async (input: ListAgentsInput): Promise<ListAgentsOutput> => {
  const { project_key } = input;
  const slug = projectSlug(project_key);
  const agents = await readAgentsPublic(project_key);
  return { slug, agents };
};
