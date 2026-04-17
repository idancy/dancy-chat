// Walks through a realistic multi-agent coordination session: one Lead,
// two parallel Workers, ~20 messages across several threads, lease
// contention, failures and recoveries, epic hand-off.
//
// Two modes:
//   Fast (tmpdir, rendered frame, auto-cleanup):
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

const LONG_PACE_MS = live ? 1100 : 0;
const SHORT_PACE_MS = live ? 400 : 0;
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Imported AFTER env is set so config.rootDir() picks it up.
const { App } = await import('../src/tui/App.js');
const { register } = await import('../src/tools/register.js');
const { sendMessage } = await import('../src/tools/sendMessage.js');
const { receiveMessages } = await import('../src/tools/receiveMessages.js');
const { acquireLease } = await import('../src/tools/acquireLease.js');
const { releaseLease } = await import('../src/tools/releaseLease.js');
const { listAgents } = await import('../src/tools/listAgents.js');

const projectKey = '/Users/thedancys/Documents/Code/money';
const log = (msg: string): void => process.stdout.write(`  ${msg}\n`);
const section = (title: string): void =>
  process.stdout.write(`\n\x1b[1m▌ ${title}\x1b[0m\n`);

type Message = {
  from: string;
  to: string;
  subject: string;
  body: string;
  thread_id?: string;
  pace?: 'short' | 'long';
  flushTo?: string; // receive-archive for this agent after send
};

const msg = (m: Message): Message => m;

const send = async (m: Message): Promise<string> => {
  const result = await sendMessage({
    project_key: projectKey,
    from: m.from,
    to: m.to,
    subject: m.subject,
    body: m.body,
    ...(m.thread_id ? { thread_id: m.thread_id } : {}),
  });
  log(`${m.from} → ${m.to}: "${m.subject}"`);
  if (m.flushTo) {
    await receiveMessages({ project_key: projectKey, agent_name: m.flushTo });
  }
  await wait(m.pace === 'short' ? SHORT_PACE_MS : LONG_PACE_MS);
  return result.msg_id;
};

section('Registering agents');
const lead = await register({
  project_key: projectKey,
  task_description: 'Lead — epic lifecycle manager (epic/qi4-receive-blocking)',
  session_id: 'demo-lead',
});
log(`lead:     ${lead.name}`);
await wait(SHORT_PACE_MS);

const alice = await register({
  project_key: projectKey,
  task_description: 'Worker — money-qi4 (receive_messages blocking support)',
  session_id: 'demo-alice',
});
log(`worker A: ${alice.name}`);
await wait(SHORT_PACE_MS);

const bob = await register({
  project_key: projectKey,
  task_description: 'Worker — money-30v (E2E test for add-row visibility)',
  session_id: 'demo-bob',
});
log(`worker B: ${bob.name}`);
await wait(LONG_PACE_MS);

section('Peer discovery');
const peers = await listAgents({ project_key: projectKey });
for (const a of peers.agents) log(`• ${a.name} — ${a.task_description}`);
await wait(LONG_PACE_MS);

section('Kickoff thread — Alice claims money-qi4');
const kickoff = await send(
  msg({
    from: alice.name,
    to: lead.name,
    subject: 'starting money-qi4 — quick sanity check',
    body: [
      'I am about to claim money-qi4 (block=true support on receive).',
      '',
      'Before I do: the task body says "no polling fallback" but the',
      'TUI has one. I read that as scope-limited to the server tool',
      'itself, not the viewer. Confirm?',
      '',
      'If yes I will start. If no I will loop back on the plan.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: alice.name,
    thread_id: kickoff,
    subject: 're: starting money-qi4 — quick sanity check',
    body: [
      'Confirmed — the "no polling" rule is for the MCP tool only. The',
      'TUI is a read-only viewer and polling there is a UX choice, not',
      'a correctness one. Proceed.',
    ].join('\n'),
    flushTo: alice.name,
  }),
);

await send(
  msg({
    from: alice.name,
    to: lead.name,
    subject: 'plan for money-qi4',
    body: [
      'Plan:',
      '  1. Add block?: boolean and timeout_s?: number to the Zod input.',
      '  2. Factor current drain path into drain() so both fast and',
      '     blocking paths share it.',
      '  3. Add waitForAdd(dir, timeoutMs, signal?) using chokidar with',
      '     awaitWriteFinish to guard against partial writes on macOS.',
      '  4. Race add-event (debounced), timeout, abort signal. Post-ready',
      '     re-scan closes the TOCTOU gap.',
      '  5. Always await watcher.close() in finally.',
      '',
      'Tests: 6 additions in messaging.test — block-returns-fast when',
      'prefilled, block-unblocks under 100ms on new send, block respects',
      'timeout, bulk-drain, per-recipient isolation, abort on client close.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: alice.name,
    subject: 're: plan for money-qi4',
    body: [
      'Plan looks good. One nit: the abort-on-client-close test is hard',
      'to write reliably — the SDK does not expose the transport signal',
      'cleanly. Skip it and note the gap in the task body; I will file',
      'a follow-up. Everything else is fine. Approved, go.',
    ].join('\n'),
    flushTo: alice.name,
  }),
);

section("Bob's thread — money-30v scope pushback");
const bobKickoff = await send(
  msg({
    from: bob.name,
    to: lead.name,
    subject: 'scope question on money-30v',
    body: [
      'Looking at money-30v (E2E for add-row visibility). The current',
      'acceptance criterion is just "add row hidden during account',
      'switch". But I see two related bugs in adjacent commits',
      '(money-2n9, money-qi4) — should my test also cover those, or',
      'stay narrowly on 30v?',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: bob.name,
    thread_id: bobKickoff,
    subject: 're: scope question on money-30v',
    body: [
      'Stay narrow. 2n9 and qi4 have their own tests and their own tasks.',
      'If you write one mega-test and any of the three regresses, the',
      'failure will point at the wrong task. Three focused tests beat one',
      'kitchen-sink test.',
    ].join('\n'),
    flushTo: bob.name,
  }),
);

section('Lease contention — port 8080');
section('(Alice grabs it first)');
const aliceLease = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: alice.name,
  ttl_s: 900,
});
log(`alice: acquired=${aliceLease.acquired}`);
await wait(SHORT_PACE_MS);

section('(Bob wants it too, gets denied)');
const bobAttempt = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: bob.name,
  ttl_s: 900,
});
log(`bob:   acquired=${bobAttempt.acquired}  current holder=${bobAttempt.holder}`);
await wait(SHORT_PACE_MS);

await send(
  msg({
    from: bob.name,
    to: alice.name,
    subject: 'waiting on ports/8080',
    body: [
      `Hey — I need ports/8080 for my E2E run but you are holding it.`,
      'Ping me when you release? No rush, my task is smaller.',
    ].join('\n'),
    flushTo: alice.name,
  }),
);

await send(
  msg({
    from: alice.name,
    to: bob.name,
    subject: 're: waiting on ports/8080',
    body: [
      'Maybe 3–5 minutes. I am mid-E2E on the money-qi4 branch. I will',
      'ping you as soon as I release.',
    ].join('\n'),
    flushTo: bob.name,
  }),
);

section('Alice hits a failure');
await send(
  msg({
    from: alice.name,
    to: lead.name,
    subject: 'E2E failure on money-qi4 — "receive hangs forever"',
    body: [
      "Two of six new tests fail on macOS. Symptom: block=true returns",
      'after the full timeout even when a message was clearly added',
      'during the wait. Logs show the add event fires in chokidar but',
      'the debounce timer never resolves.',
      '',
      'Suspect: awaitWriteFinish stabilityThreshold is too tight (20ms)',
      'for FSEvents under test-harness load — the event keeps getting',
      're-qualified and the debounce keeps resetting. Going to bump to',
      '50ms and confirm.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: alice.name,
    subject: 're: E2E failure on money-qi4',
    body: [
      'Your hypothesis matches what Node docs warn about for FSEvents.',
      'Bumping the threshold is reasonable, but add a comment pointing at',
      'the macOS-specific rationale so future readers do not "clean it',
      'up" back to 20ms.',
    ].join('\n'),
    flushTo: alice.name,
  }),
);

await send(
  msg({
    from: alice.name,
    to: lead.name,
    subject: 'update — fix confirmed',
    body: [
      'Bumped stabilityThreshold to 50ms with a block-comment rationale.',
      'All six new tests green locally. Running the whole suite now.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

section('Alice releases lease, pings Bob');
const aliceRelease = await releaseLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: alice.name,
});
log(`alice: released=${aliceRelease.released}`);
await wait(SHORT_PACE_MS);

await send(
  msg({
    from: alice.name,
    to: bob.name,
    subject: 'ports/8080 is yours',
    body: 'Done with E2E. Released. Go nuts.',
    flushTo: bob.name,
  }),
);

section('Bob acquires');
const bobLease = await acquireLease({
  project_key: projectKey,
  name: 'ports/8080',
  holder: bob.name,
  ttl_s: 600,
});
log(`bob:   acquired=${bobLease.acquired}`);
await wait(SHORT_PACE_MS);

await send(
  msg({
    from: bob.name,
    to: alice.name,
    subject: 're: ports/8080 is yours',
    body: 'Got it. Thanks.',
    flushTo: alice.name,
  }),
);

section('Closing messages');
await send(
  msg({
    from: alice.name,
    to: lead.name,
    subject: 'money-qi4 complete',
    body: [
      'All tests green: 41 unit + 5 integration + 2 TUI. Pushed to',
      'epic/qi4-receive-blocking. Closing the bd issue.',
      '',
      'Ready for the next task when you have one.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: alice.name,
    subject: 're: money-qi4 complete',
    body: [
      'Great. Next up: money-8yz (lease stale-reclaim invariant test). I',
      'will bump it to ready in bd. Grab it when you are back at the',
      'keyboard.',
    ].join('\n'),
    flushTo: alice.name,
  }),
);

await send(
  msg({
    from: bob.name,
    to: lead.name,
    subject: 'money-30v E2E written and green',
    body: [
      'Test hits the golden path plus two regressions adjacent to 30v',
      '(quick visual verification only — did not assert on them). All',
      'three pass. Pushed.',
    ].join('\n'),
    flushTo: lead.name,
  }),
);

await send(
  msg({
    from: lead.name,
    to: bob.name,
    subject: 're: money-30v E2E',
    body: [
      'Nice. Epic is now green on all three sub-tasks. I will run the',
      'full deploy gate and shipping workflow. Thanks both of you.',
    ].join('\n'),
    flushTo: bob.name,
  }),
);

section('Final lease state');
const epicLease = await acquireLease({
  project_key: projectKey,
  name: 'workspace/epic-merge',
  holder: lead.name,
  ttl_s: 1800,
});
log(`lead:  acquired=${epicLease.acquired}  name=workspace/epic-merge`);
await wait(LONG_PACE_MS);

if (!live) {
  section('TUI snapshot');
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
  log(`Demo state kept at: ${dir}`);
  log('Leave your TUI running to keep watching, or:');
  log(`  rm -rf ${dir}`);
} else {
  log(`Demo state was at: ${dir}`);
  log('Removed.');
  rmSync(dir, { recursive: true, force: true });
}
