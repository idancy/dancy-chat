import { writeThenRename } from '../fs/atomic.js';
import { readJsonSafe } from '../fs/json.js';
import { agentFile } from '../fs/paths.js';
import { AgentRecord } from '../schemas.js';
import { logger } from '../util/logger.js';

// Best-effort bump of an agent's last_active timestamp. Called from
// every tool that represents agent activity (send, receive, lease
// acquire/release). No-op if the agent isn't registered — touch is
// not an invariant, just a freshness signal. Errors are logged to
// stderr but never propagate: a failed touch must not fail the
// primary tool call.
export const touchAgent = async (
  projectKey: string,
  name: string,
): Promise<void> => {
  const path = agentFile(projectKey, name);
  try {
    const existing = await readJsonSafe(path, AgentRecord);
    if (!existing) return;
    const updated: AgentRecord = {
      ...existing,
      last_active: new Date().toISOString(),
    };
    await writeThenRename(path, `${JSON.stringify(updated, null, 2)}\n`);
  } catch (err) {
    logger.warn('touchAgent failed', {
      name,
      error: (err as Error).message,
    });
  }
};
