import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

// Create a new file with exclusive semantics. Throws ENOENT-style error
// codes through; throws EEXIST if the file already exists. Caller
// treats EEXIST as a race signal.
export const writeExclusive = async (path: string, content: string): Promise<void> => {
  await ensureDir(dirname(path));
  await fs.writeFile(path, content, { flag: 'wx' });
};

// Atomic overwrite via tmp + fsync + rename. Use for updates to an
// existing file (e.g. bumping last_active).
export const writeThenRename = async (path: string, content: string): Promise<void> => {
  await ensureDir(dirname(path));
  const tmp = `${path}.tmp.${process.pid}.${randomBytes(4).toString('hex')}`;
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, path);
};

// "Compare and swap" via rename. Returns true if THIS call did the
// rename (we won), false if the source no longer exists (someone else
// already moved/deleted it). Any other error propagates.
export const renameCAS = async (src: string, dst: string): Promise<boolean> => {
  try {
    await ensureDir(dirname(dst));
    await fs.rename(src, dst);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
};

export const unlinkIfExists = async (path: string): Promise<boolean> => {
  try {
    await fs.unlink(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
};
