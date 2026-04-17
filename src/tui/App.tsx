import { Box, Text, useApp, useInput } from 'ink';
import React from 'react';
import { projectSlug } from '../config.js';
import { AgentsPanel } from './AgentsPanel.js';
import { LeasesPanel } from './LeasesPanel.js';
import { MessagesPanel } from './MessagesPanel.js';
import { useProjectWatch } from './useProjectWatch.js';

type Props = {
  projectKey: string;
};

export const App = ({ projectKey }: Props): React.ReactElement => {
  const { exit } = useApp();
  const { agents, leases, messages } = useProjectWatch(projectKey);
  const slug = projectSlug(projectKey);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
  });

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
        <Box flexDirection="column" width={38} marginRight={1}>
          <AgentsPanel agents={agents} />
          <LeasesPanel leases={leases} />
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <MessagesPanel messages={messages} />
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>q quit · Ctrl+C exit</Text>
      </Box>
    </Box>
  );
};
