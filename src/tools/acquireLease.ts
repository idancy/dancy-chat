import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { renameCAS, writeExclusive } from '../fs/atomic.js';
import { readJsonSafe } from '../fs/json.js';
import { leaseFile } from '../fs/paths.js';
import {
  LeaseRecord,
  type AcquireLeaseInput,
  type AcquireLeaseOutput,
} from '../schemas.js';

const buildLease = (name: string, holder: string, ttl_s: number): LeaseRecord => {
  const now = Date.now();
  return {
    name,
    holder,
    ttl_s,
    acquired_at_ms: now,
    expires_at_ms: now + ttl_s * 1000,
  };
};

const serialize = (record: LeaseRecord): string => `${JSON.stringify(record, null, 2)}\n`;

const denied = (record: LeaseRecord): AcquireLeaseOutput => ({
  acquired: false,
  holder: record.holder,
  expires_at: new Date(record.expires_at_ms).toISOString(),
});

const granted = (record: LeaseRecord): AcquireLeaseOutput => ({
  acquired: true,
  holder: record.holder,
  expires_at: new Date(record.expires_at_ms).toISOString(),
});

const tryFreshAcquire = async (
  path: string,
  record: LeaseRecord,
): Promise<AcquireLeaseOutput | null> => {
  try {
    await writeExclusive(path, serialize(record));
    return granted(record);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw err;
  }
};

export const acquireLease = async (
  input: AcquireLeaseInput,
): Promise<AcquireLeaseOutput> => {
  const { project_key, name, holder, ttl_s } = input;
  const path = leaseFile(project_key, name);
  const mine = buildLease(name, holder, ttl_s);

  // Fast path: no existing lease.
  const fresh = await tryFreshAcquire(path, mine);
  if (fresh) return fresh;

  // Slow path: something is there. Read to decide.
  const existing = await readJsonSafe(path, LeaseRecord);
  if (!existing) {
    // Disappeared between our write and our read — try once more.
    const retry = await tryFreshAcquire(path, mine);
    if (retry) return retry;
    const settled = await readJsonSafe(path, LeaseRecord);
    return settled ? denied(settled) : denied(mine);
  }

  if (existing.expires_at_ms > Date.now()) {
    return denied(existing);
  }

  // Stale — try to reclaim via rename-as-CAS. Exactly one concurrent
  // reclaim wins; others see ENOENT and fall back to checking the
  // current holder.
  const stale = `${path}.stale.${randomBytes(4).toString('hex')}`;
  const wonReclaim = await renameCAS(path, stale);
  if (!wonReclaim) {
    const after = await readJsonSafe(path, LeaseRecord);
    return after ? denied(after) : denied(mine);
  }

  // We won the reclaim; clean up the stale trash and install ours.
  try {
    await fs.unlink(stale);
  } catch {
    // best effort — not required for correctness
  }
  const installed = await tryFreshAcquire(path, mine);
  if (installed) return installed;

  // Extremely unlikely: a racer inserted a fresh lease between our
  // reclaim and our install. Fall back to reporting the current holder.
  const finalCheck = await readJsonSafe(path, LeaseRecord);
  return finalCheck ? denied(finalCheck) : denied(mine);
};
