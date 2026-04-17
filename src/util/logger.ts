const write = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  const line = extra
    ? `[${new Date().toISOString()}] ${level} ${msg} ${JSON.stringify(extra)}\n`
    : `[${new Date().toISOString()}] ${level} ${msg}\n`;
  process.stderr.write(line);
};

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => write('INFO', msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => write('WARN', msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write('ERROR', msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => {
    if (process.env.DANCY_CHAT_DEBUG) write('DEBUG', msg, extra);
  },
};
