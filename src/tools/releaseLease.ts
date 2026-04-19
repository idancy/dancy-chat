import { unlinkIfExists } from '../fs/atomic.js';
import { readJsonSafe } from '../fs/json.js';
import { leaseFile } from '../fs/paths.js';
import {
  LeaseRecord,
  type ReleaseLeaseInput,
  type ReleaseLeaseOutput,
} from '../schemas.js';
import { touchAgent } from './touchAgent.js';

// Best-effort release. The narrow TOCTOU window between reading the
// holder and unlinking the file only matters if the lease expires AND a
// new acquirer reclaims it in the microseconds between those calls —
// which can only happen past TTL, at which point the prior holder's
// claim is already invalid. Accepted risk.
export const releaseLease = async (
  input: ReleaseLeaseInput,
): Promise<ReleaseLeaseOutput> => {
  const { project_key, name, holder } = input;
  await touchAgent(project_key, holder);
  const path = leaseFile(project_key, name);
  const existing = await readJsonSafe(path, LeaseRecord);
  if (!existing || existing.holder !== holder) {
    return { released: false };
  }
  const removed = await unlinkIfExists(path);
  return { released: removed };
};
