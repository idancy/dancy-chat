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

const lineCount = (body: string): number => {
  if (!body) return 0;
  return body.split('\n').length;
};

const preview = (body: string, maxLen = 80): string => {
  const firstLine = body.split('\n')[0] ?? '';
  if (firstLine.length <= maxLen) return firstLine;
  return `${firstLine.slice(0, maxLen - 1)}…`;
};

type Props = {
  messages: MessageRecord[];
  limit?: number;
};

export const MessagesPanel = ({ messages, limit = 30 }: Props): React.ReactElement => {
  const tail = messages.slice(-limit);
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
      <Text bold>MESSAGES ({messages.length})</Text>
      {tail.length === 0 ? (
        <Text dimColor>no messages yet</Text>
      ) : (
        tail.map((m) => {
          const lines = lineCount(m.body);
          return (
            <Box key={m.msg_id} flexDirection="column" marginTop={1}>
              <Box>
                <Text color="yellow">{formatTime(m.sent_at)}</Text>
                <Text>{'  '}</Text>
                <Text color="cyan">{m.from}</Text>
                <Text dimColor>{' → '}</Text>
                <Text color="cyan">{m.to}</Text>
              </Box>
              <Text>
                <Text bold>"{m.subject}"</Text>
                <Text dimColor>{lines > 0 ? ` (${lines} line${lines === 1 ? '' : 's'})` : ''}</Text>
              </Text>
              {preview(m.body) !== '' && (
                <Text dimColor>  {preview(m.body)}</Text>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};
