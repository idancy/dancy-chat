import { join } from 'node:path';
import { projectDir } from '../config.js';

export const agentsDir = (projectKey: string): string => join(projectDir(projectKey), 'agents');
export const agentFile = (projectKey: string, name: string): string =>
  join(agentsDir(projectKey), `${name}.json`);

export const messagesDir = (projectKey: string): string =>
  join(projectDir(projectKey), 'messages');
export const agentInbox = (projectKey: string, name: string): string =>
  join(messagesDir(projectKey), name);
export const agentArchive = (projectKey: string, name: string): string =>
  join(agentInbox(projectKey, name), 'archive');
export const messageFile = (projectKey: string, to: string, filename: string): string =>
  join(agentInbox(projectKey, to), filename);

export const leasesDir = (projectKey: string): string => join(projectDir(projectKey), 'leases');
export const leaseFile = (projectKey: string, name: string): string => {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(leasesDir(projectKey), `${safe}.json`);
};
