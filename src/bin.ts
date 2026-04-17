#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './util/logger.js';

const main = async (): Promise<void> => {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('dancy-chat stdio server ready');
};

main().catch((err) => {
  logger.error('fatal', { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
