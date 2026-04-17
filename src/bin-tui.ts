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

render(React.createElement(App, { projectKey }));
