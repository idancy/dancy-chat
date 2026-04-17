import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { deriveSlug } from './util/slug.js';

export const rootDir = (): string =>
  process.env.DANCY_CHAT_DIR
    ? resolve(process.env.DANCY_CHAT_DIR)
    : join(homedir(), '.dancy-chat');

export const projectSlug = (projectKey: string): string => deriveSlug(projectKey);

export const projectDir = (projectKey: string): string =>
  join(rootDir(), 'projects', projectSlug(projectKey));
