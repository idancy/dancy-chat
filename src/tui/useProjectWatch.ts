import chokidar from 'chokidar';
import { useEffect, useRef, useState } from 'react';
import { projectDir } from '../config.js';
import { readAgents, readLeases, tailMessages, type NamedLease } from '../fs/reader.js';
import type { AgentRecord, MessageRecord } from '../schemas.js';

export type ProjectState = {
  agents: AgentRecord[];
  leases: NamedLease[];
  messages: MessageRecord[];
};

const EMPTY: ProjectState = { agents: [], leases: [], messages: [] };

export const useProjectWatch = (
  projectKey: string,
  messageLimit = 100,
): ProjectState => {
  const [state, setState] = useState<ProjectState>(EMPTY);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const dir = projectDir(projectKey);

    const refresh = async (): Promise<void> => {
      if (cancelledRef.current) return;
      try {
        const [agents, leases, messages] = await Promise.all([
          readAgents(projectKey),
          readLeases(projectKey),
          tailMessages(projectKey, messageLimit),
        ]);
        if (!cancelledRef.current) setState({ agents, leases, messages });
      } catch {
        // swallow — errors surface via empty state
      }
    };

    void refresh();

    const watcher = chokidar.watch(dir, {
      depth: 3,
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

    return () => {
      cancelledRef.current = true;
      if (debounce) clearTimeout(debounce);
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
