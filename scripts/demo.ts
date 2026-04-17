// Walks through a realistic two-agent coordination flow.
//
// Two modes:
//   Fast (tmpdir, rendered-frame, auto-cleanup):
//     npx tsx scripts/demo.ts
//   Live (honors existing DANCY_CHAT_DIR, paced, keeps state):
//     DANCY_CHAT_DIR=/tmp/dancy-chat-demo npx tsx scripts/demo.ts
//
// In live mode, run the TUI in another terminal with the same
// DANCY_CHAT_DIR to watch panels fill up in real time.

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';

const live = Boolean(process.env.DANCY_CHAT_DIR);
const dir = live
  ? process.env.DANCY_CHAT_DIR!
  : mkdtempSync(join(tmpdir(), 'dancy-chat-demo-'));
if (live) mkdirSync(dir, { recursive: true });
process.env.DANCY_CHAT_DIR = dir;

const PACE_MS = live ? 900 : 0;
const pace = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, PACE_MS));

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
await pace();

section('2. Worker registers');
const worker = await register({
  project_key: projectKey,
  task_description: 'Worker — implementing money-qi4',
  session_id: 'session-worker-demo',
});
line(`name: ${worker.name}`);
await pace();

section('3. Worker discovers peers via list_agents');
const peers = await listAgents({ project_key: projectKey });
for (const a of peers.agents) {
  line(`• ${a.name} — ${a.task_description}`);
}
await pace();

section('4. Worker sends clarifying questions');
const q = await sendMessage({
  project_key: projectKey,
  from: worker.name,
  to: lead.name,
  subject: 'clarifying questions',
  body: '1. Are messages idempotent?\n2. Can a worker hold two leases?\n3. Where do archived messages live?',
});
line(`msg_id: ${q.msg_id}`);
await pace();

section('5. Lead receives the question (non-blocking)');
const leadInbox = await receiveMessages({ project_key: projectKey, agent_name: lead.name });
line(`messages pending: ${leadInbox.messages.length}`);
for (const m of leadInbox.messages) {
  line(`  "${m.subject}" from ${m.from}`);
}
await pace();

section('6. Lead replies with answers');
await sendMessage({
  project_key: projectKey,
  from: lead.name,
  to: worker.name,
  subject: 're: clarifying questions',
  body: 'Yes, no, and messages/<agent>/archive/. Proceed with the plan.',
  thread_id: q.msg_id,
});
await pace();

section('7. Worker receives reply');
const workerInbox = await receiveMessages({
  project_key: projectKey,
  agent_name: worker.name,
});
for (const m of workerInbox.messages) {
  line(`  "${m.subject}" from ${m.from} (thread: ${m.thread_id ?? 'none'})`);
}
await pace();

section('8. Worker acquires ports/8080 lease before starting dev server');
const firstLease = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: worker.name,
  ttl_s: 600,
});
line(`acquired: ${firstLease.acquired}  holder: ${firstLease.holder}`);
line(`expires: ${firstLease.expires_at}`);
await pace();

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
await pace();

section('10. Worker releases the lease');
const released = await releaseLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: worker.name,
});
line(`released: ${released.released}`);
await pace();

section('11. Acquire another lease so the TUI has something to show');
await acquireLease({
  project_key: projectKey,
  name: 'workspace/main',
  holder: lead.name,
  ttl_s: 1200,
});
await pace();

if (!live) {
  section('12. TUI snapshot');
  const { lastFrame, unmount } = render(
    React.createElement(App, { projectKey }),
  );
  await new Promise((r) => setTimeout(r, 300));
  process.stdout.write('\n');
  process.stdout.write(lastFrame() ?? '(empty)');
  process.stdout.write('\n');
  unmount();
}

section('done');
if (live) {
  line(`Demo state kept at: ${dir}`);
  line('Leave your TUI running to keep watching, or:');
  line(`  rm -rf ${dir}`);
} else {
  line(`Demo state was at: ${dir}`);
  line('Removed.');
  rmSync(dir, { recursive: true, force: true });
}
