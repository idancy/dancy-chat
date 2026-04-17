import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';

const SLUG_CHARS = /[^a-z0-9]+/g;

const readableStem = (projectKey: string): string => {
  const base = basename(resolve(projectKey)).toLowerCase();
  const cleaned = base.replace(SLUG_CHARS, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'project';
};

export const deriveSlug = (projectKey: string): string => {
  const stem = readableStem(projectKey);
  const hash = createHash('sha256')
    .update(resolve(projectKey))
    .digest('hex')
    .slice(0, 6);
  return `${stem}-${hash}`;
};
