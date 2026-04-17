import { promises as fs } from 'node:fs';
import type { ZodType } from 'zod';

export const readJson = async <T>(path: string, schema: ZodType<T>): Promise<T> => {
  const content = await fs.readFile(path, 'utf8');
  return schema.parse(JSON.parse(content));
};

// Returns null if the file does not exist. Any other error (parse
// failure, permission, etc.) propagates so callers can decide.
export const readJsonSafe = async <T>(
  path: string,
  schema: ZodType<T>,
): Promise<T | null> => {
  try {
    return await readJson(path, schema);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
};
