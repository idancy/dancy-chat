import { Box, Text } from 'ink';
import React from 'react';
import type { MessageRecord } from '../schemas.js';

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const bodyLines = (body: string): string[] => {
  if (!body) return [];
  return body.split('\n');
};

type Props = {
  messages: MessageRecord[];
  limit?: number;
};

export const MessagesPanel = ({ messages, limit = 4 }: Props): React.ReactElement => {
  const tail = messages.slice(-limit);
  const hidden = messages.length - tail.length;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      <Text bold>
        MESSAGES ({messages.length}
        {hidden > 0 ? `, showing last ${tail.length}` : ''})
      </Text>
      {tail.length === 0 ? (
        <Text dimColor>no messages yet</Text>
      ) : (
        tail.map((m) => {
          const lines = bodyLines(m.body);
          return (
            <Box key={m.msg_id} flexDirection="column" marginTop={1}>
              <Box>
                <Text color="yellow">{formatTime(m.sent_at)}</Text>
                <Text>{'  '}</Text>
                <Text color="cyan">{m.from}</Text>
                <Text dimColor>{' → '}</Text>
                <Text color="cyan">{m.to}</Text>
              </Box>
              <Text bold>"{m.subject}"</Text>
              {lines.length > 0 && (
                <Box flexDirection="column">
                  {lines.map((line, i) => (
                    <Text key={i} dimColor>
                      {'  '}
                      {line === '' ? ' ' : line}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};
