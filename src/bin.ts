#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getRegistrations, teardownAll } from './lifecycle.js';
import { createServer } from './server.js';
import { logger } from './util/logger.js';

let shuttingDown = false;

const shutdown = async (reason: string): Promise<never> => {
  if (shuttingDown) return new Promise(() => undefined) as Promise<never>;
  shuttingDown = true;
  logger.info('shutting down', { reason });
  try {
    const result = await teardownAll(getRegistrations());
    logger.info('teardown complete', {
      deleted_agents: result.deleted_agents.length,
      released_leases: result.released_leases.length,
      removed_message_dirs: result.removed_message_dirs.length,
      removed_projects: result.removed_projects.length,
    });
  } catch (err) {
    logger.error('teardown failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  process.exit(0);
};

const main = async (): Promise<void> => {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('dancy-chat stdio server ready');

  // The SDK's StdioServerTransport only listens for 'data' and 'error'
  // on stdin — not 'end'. Hook the raw stream directly so an EOF (the
  // signal Claude Code sends when the session closes) triggers our
  // teardown. Signal handlers catch manual kills as a backstop.
  process.stdin.on('end', () => void shutdown('stdin_eof'));
  process.stdin.on('close', () => void shutdown('stdin_close'));
  process.on('SIGTERM', () => void shutdown('sigterm'));
  process.on('SIGINT', () => void shutdown('sigint'));
};

main().catch((err) => {
  logger.error('fatal', { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
