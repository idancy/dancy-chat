import { Box, Text } from 'ink';
import React from 'react';
import type { AgentRecord } from '../schemas.js';
import { useNow } from './useProjectWatch.js';

const formatAge = (iso: string, nowMs: number): string => {
  const age = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  return `${Math.floor(age / 3600)}h ago`;
};

type Props = {
  agents: AgentRecord[];
};

export const AgentsPanel = ({ agents }: Props): React.ReactElement => {
  const now = useNow(1_000);
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>AGENTS ({agents.length})</Text>
      {agents.length === 0 ? (
        <Text dimColor>none registered</Text>
      ) : (
        agents.map((a) => (
          <Box key={a.name} flexDirection="column" marginTop={1}>
            <Text color="cyan">{a.name}</Text>
            <Text dimColor>{a.task_description}</Text>
            <Text dimColor>active {formatAge(a.last_active, now)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
};
