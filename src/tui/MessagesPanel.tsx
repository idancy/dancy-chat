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

// Rendered height of a single body line given the wrap width available
// to the body (panel width minus its paddings and the "  " indent).
const wrappedRows = (line: string, wrapCols: number): number => {
  const w = Math.max(1, wrapCols);
  return Math.max(1, Math.ceil((line.length || 1) / w));
};

const messageHeight = (
  lines: string[],
  wrapCols: number,
): number => {
  // marginTop (1) + meta row (1) + subject (1) + wrapped body rows
  const body = lines.reduce((sum, l) => sum + wrappedRows(l, wrapCols), 0);
  return 3 + body;
};

type FitEntry = {
  message: MessageRecord;
  lines: string[];
  truncated: boolean;
};

const fit = (
  messages: MessageRecord[],
  budget: number,
  wrapCols: number,
  hardLimit?: number,
): FitEntry[] => {
  const candidates = hardLimit != null ? messages.slice(-hardLimit) : messages;
  const newestFirst = candidates.slice().reverse();
  const picked: FitEntry[] = [];
  let used = 0;

  for (const m of newestFirst) {
    const lines = bodyLines(m.body);
    const height = messageHeight(lines, wrapCols);
    if (used + height <= budget) {
      picked.push({ message: m, lines, truncated: false });
      used += height;
      continue;
    }
    // Doesn't fit in full. Fill whatever rows remain with as much of
    // this message as we can: marginTop + meta + subject + some body
    // lines + "…". Need at least 4 rows (3 skeleton + 1 ellipsis) to
    // be worth including.
    const remaining = budget - used;
    if (remaining < 4) break;
    const bodyBudget = remaining - 3 - 1; // skeleton + ellipsis
    const keep: string[] = [];
    let bodyUsed = 0;
    for (const line of lines) {
      const r = wrappedRows(line, wrapCols);
      if (bodyUsed + r > bodyBudget) break;
      keep.push(line);
      bodyUsed += r;
    }
    picked.push({ message: m, lines: keep, truncated: true });
    break;
  }
  return picked;
};

type Props = {
  messages: MessageRecord[];
  maxHeight: number;
  columns: number;
  limit?: number;
};

export const MessagesPanel = ({
  messages,
  maxHeight,
  columns,
  limit,
}: Props): React.ReactElement => {
  // Panel has paddingX=1 (2 cols), and body lines are indented with "  " (2 cols).
  const wrapCols = Math.max(1, columns - 4);
  const picked = fit(messages, maxHeight, wrapCols, limit);
  const hidden = messages.length - picked.length;
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold>
        MESSAGES ({messages.length}
        {hidden > 0 ? `, showing last ${picked.length}` : ''})
      </Text>
      {picked.length === 0 ? (
        <Text dimColor>no messages yet</Text>
      ) : (
        picked.map(({ message: m, lines, truncated }) => (
          <Box key={m.msg_id} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="yellow">{formatTime(m.sent_at)}</Text>
              <Text>{'  '}</Text>
              <Text color="cyan">{m.from}</Text>
              <Text dimColor>{' → '}</Text>
              <Text color="cyan">{m.to}</Text>
            </Box>
            <Text bold>"{m.subject}"</Text>
            {(lines.length > 0 || truncated) && (
              <Box flexDirection="column">
                {lines.map((line, i) => (
                  <Text key={i} dimColor>
                    {'  '}
                    {line === '' ? ' ' : line}
                  </Text>
                ))}
                {truncated && <Text dimColor>{'  …'}</Text>}
              </Box>
            )}
          </Box>
        ))
      )}
    </Box>
  );
};
