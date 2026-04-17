// Walks through a realistic two-agent coordination flow, then renders
// the TUI once and prints the frame. Run with:
//   npx tsx scripts/demo.ts
//
// Sets DANCY_CHAT_DIR to a fresh tmp dir so the demo doesn't touch your
// real ~/.dancy-chat.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';

const dir = mkdtempSync(join(tmpdir(), 'dancy-chat-demo-'));
process.env.DANCY_CHAT_DIR = dir;

// Imported AFTER env is set so config.rootDir() picks it up.
const { App } = await import('../src/tui/App.js');
const { register } = await import('../src/tools/register.js');
const { sendMessage } = await import('../src/tools/sendMessage.js');
const { receiveMessages } = await import('../src/tools/receiveMessages.js');
const { acquireLease } = await import('../src/tools/acquireLease.js');
const { releaseLease } = await import('../src/tools/releaseLease.js');
const { listAgents } = await import('../src/tools/listAgents.js');

const projectKey = '/Users/thedancys/Documents/Code/money';
const line = (msg: string): void => process.stdout.write(`  ${msg}\n`);
const section = (title: string): void => process.stdout.write(`\n\x1b[1m▌ ${title}\x1b[0m\n`);

section('1. Lead registers');
const lead = await register({
  project_key: projectKey,
  task_description: 'Lead — epic lifecycle manager',
  session_id: 'session-lead-demo',
});
line(`name: ${lead.name}  slug: ${lead.slug}`);

section('2. Worker registers');
const worker = await register({
  project_key: projectKey,
  task_description: 'Worker — implementing money-qi4',
  session_id: 'session-worker-demo',
});
line(`name: ${worker.name}`);

section('3. Worker discovers peers via list_agents');
const peers = await listAgents({ project_key: projectKey });
for (const a of peers.agents) {
  line(`• ${a.name} — ${a.task_description}`);
}

section('4. Worker sends clarifying questions');
const q = await sendMessage({
  project_key: projectKey,
  from: worker.name,
  to: lead.name,
  subject: 'clarifying questions',
  body: '1. Are messages idempotent?\n2. Can a worker hold two leases?\n3. Where do archived messages live?',
});
line(`msg_id: ${q.msg_id}`);

section('5. Lead receives the question (non-blocking)');
const leadInbox = await receiveMessages({ project_key: projectKey, agent_name: lead.name });
line(`messages pending: ${leadInbox.messages.length}`);
for (const m of leadInbox.messages) {
  line(`  "${m.subject}" from ${m.from}`);
}

section('6. Lead replies with answers');
await sendMessage({
  project_key: projectKey,
  from: lead.name,
  to: worker.name,
  subject: 're: clarifying questions',
  body: 'Yes, no, and messages/<agent>/archive/. Proceed with the plan.',
  thread_id: q.msg_id,
});

section('7. Worker receives reply');
const workerInbox = await receiveMessages({
  project_key: projectKey,
  agent_name: worker.name,
});
for (const m of workerInbox.messages) {
  line(`  "${m.subject}" from ${m.from} (thread: ${m.thread_id ?? 'none'})`);
}

section('8. Worker acquires ports/8080 lease before starting dev server');
const firstLease = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: worker.name,
  ttl_s: 600,
});
line(`acquired: ${firstLease.acquired}  holder: ${firstLease.holder}`);
line(`expires: ${firstLease.expires_at}`);

section('9. Lead tries to reserve the same port (should be denied)');
const contention = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: lead.name,
  ttl_s: 600,
});
line(
  `acquired: ${contention.acquired}  holder: ${contention.holder} (still ${worker.name === contention.holder ? 'the worker' : 'someone else'})`,
);

section('10. Worker releases the lease');
const released = await releaseLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: worker.name,
});
line(`released: ${released.released}`);

section('11. Acquire another lease so the TUI has something to show');
await acquireLease({
  project_key: projectKey,
  name: 'workspace/main',
  holder: lead.name,
  ttl_s: 1200,
});

section('12. TUI snapshot');
const { lastFrame, unmount } = render(
  React.createElement(App, { projectKey }),
);
await new Promise((r) => setTimeout(r, 300));
process.stdout.write('\n');
process.stdout.write(lastFrame() ?? '(empty)');
process.stdout.write('\n');
unmount();

section('done');
line(`Demo state lives at: ${dir}`);
line('It will be removed automatically.');
rmSync(dir, { recursive: true, force: true });
