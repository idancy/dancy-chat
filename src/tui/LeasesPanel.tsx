import { Box, Text } from 'ink';
import React from 'react';
import type { NamedLease } from '../fs/reader.js';

const formatRemaining = (expiresAtMs: number, nowMs: number): string => {
  const remainingS = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
  if (remainingS === 0) return 'expired';
  const m = Math.floor(remainingS / 60);
  const s = remainingS % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, '0')}s` : `${s}s`;
};

type Props = {
  leases: NamedLease[];
  now: number;
};

export const LeasesPanel = ({ leases, now }: Props): React.ReactElement => {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>LEASES ({leases.length})</Text>
      {leases.length === 0 ? (
        <Text dimColor>none held</Text>
      ) : (
        leases.map(({ name, record }) => {
          const expired = record.expires_at_ms <= now;
          return (
            <Box key={name} flexDirection="column" marginTop={1}>
              <Text color="magenta">{name}</Text>
              <Text dimColor>held by {record.holder}</Text>
              <Text color={expired ? 'red' : undefined} dimColor={!expired}>
                {expired ? 'expired' : `expires in ${formatRemaining(record.expires_at_ms, now)}`}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
