#!/usr/bin/env node
import { render } from 'ink';
import meow from 'meow';
import React from 'react';
import { resolve } from 'node:path';
import { App } from './tui/App.js';

const cli = meow(
  `
  Dancy Chat — live view of agent coordination in a project.

  Usage
    $ dancy-chat-tui [options]

  Options
    --project <path>    Project key (default: current working directory)
    --help              Show this help
    --version           Show version

  Examples
    $ dancy-chat-tui
    $ dancy-chat-tui --project ~/Documents/Code/money
`,
  {
    importMeta: import.meta,
    flags: {
      project: { type: 'string' },
    },
  },
);

const projectKey = resolve(cli.flags.project ?? process.cwd());

// Move rendering to the alternate screen buffer so Ink's in-place
// repaints don't flicker the primary terminal, and the user's
// scrollback is preserved across a session.
process.stdout.write('\x1b[?1049h\x1b[H');
process.on('exit', () => {
  process.stdout.write('\x1b[?1049l');
});

// Wrap each frame write in DEC 2026 synchronized output so the
// clear-then-repaint sequence Ink emits is presented atomically.
// Terminals that don't support DEC 2026 silently ignore the mode.
const syncStdout = new Proxy(process.stdout, {
  get(target, prop, receiver) {
    if (prop === 'write') {
      return (chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
        const payload = typeof chunk === 'string' ? chunk : chunk.toString();
        return (target.write as (c: string, ...r: unknown[]) => boolean)(
          `\x1b[?2026h${payload}\x1b[?2026l`,
          ...rest,
        );
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

render(React.createElement(App, { projectKey }), {
  stdout: syncStdout as NodeJS.WriteStream,
});
