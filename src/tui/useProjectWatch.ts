import chokidar from 'chokidar';
import { useStdout } from 'ink';
import { mkdirSync } from 'node:fs';
import { useEffect, useRef, useState } from 'react';
import { projectDir } from '../config.js';
import {
  readAgents,
  readLeases,
  tailMessages,
  type NamedLease,
  type ObservedMessage,
} from '../fs/reader.js';
import type { AgentRecord } from '../schemas.js';

export type ProjectState = {
  agents: AgentRecord[];
  leases: NamedLease[];
  messages: ObservedMessage[];
};

const EMPTY: ProjectState = { agents: [], leases: [], messages: [] };

export const useProjectWatch = (
  projectKey: string,
  messageLimit = 100,
): ProjectState => {
  const [state, setState] = useState<ProjectState>(EMPTY);
  const cancelledRef = useRef(false);
  const fingerprintRef = useRef<string>('');

  useEffect(() => {
    cancelledRef.current = false;
    fingerprintRef.current = '';
    const dir = projectDir(projectKey);
    // chokidar silently watches nothing if the path doesn't exist when
    // the watcher starts. Ensure it before arming.
    mkdirSync(dir, { recursive: true });

    const refresh = async (): Promise<void> => {
      if (cancelledRef.current) return;
      try {
        const [agents, leases, messages] = await Promise.all([
          readAgents(projectKey),
          readLeases(projectKey),
          tailMessages(projectKey, messageLimit),
        ]);
        if (cancelledRef.current) return;
        // Skip setState when nothing visible has changed. The 1s poll
        // otherwise forces a re-render every tick even when the project
        // is idle, which combined with Ink's in-place repaint shows up
        // as flicker.
        const fp =
          `${agents.length}:${agents.map((a) => `${a.name}@${a.last_active}`).join(',')}|` +
          `${leases.length}:${leases.map((l) => `${l.name}@${l.record.expires_at_ms}:${l.record.holder}`).join(',')}|` +
          `${messages.length}:${messages.map((m) => `${m.record.msg_id}${m.status[0]}`).join(',')}`;
        if (fp === fingerprintRef.current) return;
        fingerprintRef.current = fp;
        setState({ agents, leases, messages });
      } catch {
        // swallow — errors surface via empty state
      }
    };

    void refresh();

    const watcher = chokidar.watch(dir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });

    let debounce: NodeJS.Timeout | null = null;
    const schedule = (): void => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void refresh();
      }, 50);
    };

    watcher.on('all', schedule);

    // Belt-and-suspenders: poll every second in case an fs event is
    // missed (chokidar + macOS FSEvents can coalesce or drop events
    // under load). 1s is cheap and bounds staleness.
    const pollTimer = setInterval(() => {
      void refresh();
    }, 1_000);

    return () => {
      cancelledRef.current = true;
      if (debounce) clearTimeout(debounce);
      clearInterval(pollTimer);
      void watcher.close();
    };
  }, [projectKey, messageLimit]);

  return state;
};

export const useNow = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export type TerminalSize = { rows: number; columns: number };

export const useTerminalSize = (): TerminalSize => {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => ({
    rows: stdout.rows ?? 24,
    columns: stdout.columns ?? 80,
  }));
  useEffect(() => {
    const onResize = (): void => {
      setSize({ rows: stdout.rows ?? 24, columns: stdout.columns ?? 80 });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);
  return size;
};
