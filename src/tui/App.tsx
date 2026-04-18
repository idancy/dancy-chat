import { Box, Text, useApp, useInput } from 'ink';
import React from 'react';
import { projectSlug } from '../config.js';
import { AgentsPanel } from './AgentsPanel.js';
import { LeasesPanel } from './LeasesPanel.js';
import { MessagesPanel } from './MessagesPanel.js';
import { useNow, useProjectWatch, useTerminalSize } from './useProjectWatch.js';

type Props = {
  projectKey: string;
};

export const App = ({ projectKey }: Props): React.ReactElement => {
  const { exit } = useApp();
  const { agents, leases, messages } = useProjectWatch(projectKey);
  const now = useNow(1_000);
  const { rows, columns } = useTerminalSize();
  const slug = projectSlug(projectKey);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
  });

  // Estimate remaining rows for the messages section. Layout heights:
  //   header row (double border)           = 3
  //   top row (agents|leases panels)       = 3 + 4*max(1, count) each, take max
  //   messages panel overhead (title+gap)  = 2
  //   footer                               = 1
  const agentLines = 3 + 3 * Math.max(1, agents.length);
  const leaseLines = 3 + 4 * Math.max(1, leases.length);
  const topRowLines = Math.max(agentLines, leaseLines);
  const messagesBudget = Math.max(3, rows - 3 - topRowLines - 2 - 1);

  return (
    <Box flexDirection="column">
      <Box borderStyle="double" paddingX={1}>
        <Text bold color="green">
          Dancy Chat
        </Text>
        <Text> · </Text>
        <Text>{slug}</Text>
        <Text dimColor>
          {' · '}
          {agents.length} agent{agents.length === 1 ? '' : 's'}
          {' · '}
          {leases.length} lease{leases.length === 1 ? '' : 's'}
        </Text>
      </Box>
      <Box>
        <Box flexGrow={1} marginRight={1}>
          <AgentsPanel agents={agents} />
        </Box>
        <Box flexGrow={1}>
          <LeasesPanel leases={leases} now={now} />
        </Box>
      </Box>
      <MessagesPanel messages={messages} maxHeight={messagesBudget} columns={columns} />
      <Box paddingX={1}>
        <Text dimColor>q quit · Ctrl+C exit</Text>
      </Box>
    </Box>
  );
};
