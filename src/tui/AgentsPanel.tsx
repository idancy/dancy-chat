import { Box, Text } from 'ink';
import React from 'react';
import type { AgentRecord } from '../schemas.js';

type Props = {
  agents: AgentRecord[];
};

export const AgentsPanel = ({ agents }: Props): React.ReactElement => {
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
          </Box>
        ))
      )}
    </Box>
  );
};
