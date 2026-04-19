import { Box, Text } from 'ink';
import React from 'react';
import type { AgentRecord } from '../schemas.js';
import { useNow } from './useProjectWatch.js';

const formatAge = (lastActiveIso: string, now: number): string => {
  const deltaMs = Math.max(0, now - new Date(lastActiveIso).getTime());
  const s = Math.floor(deltaMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

type Props = {
  agents: AgentRecord[];
};

export const AgentsPanel = ({ agents }: Props): React.ReactElement => {
  // 5s is enough granularity for an age readout and keeps render churn
  // far below the 1Hz tick the old "active <ago>" row used to demand.
  const now = useNow(5_000);
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>AGENTS ({agents.length})</Text>
      {agents.length === 0 ? (
        <Text dimColor>none registered</Text>
      ) : (
        agents.map((a) => (
          <Box key={a.name} flexDirection="column" marginTop={1}>
            <Text color="cyan">{a.name}</Text>
            <Text dimColor>
              {a.task_description} · {formatAge(a.last_active, now)}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
};
