# Dancy Chat

Stdio MCP server and read-only TUI for coordinating parallel Claude Code
agents via filesystem-backed messages and leases. Replacement for
`mcp-agent-mail` with an ~80% smaller surface.

## Design

- **Transport:** stdio (no HTTP daemon, spawned per Claude session).
- **Storage:** flat JSON files under `~/.dancy-chat/` (override with
  `DANCY_CHAT_DIR`). Atomic writes via `O_EXCL` and rename-CAS.
- **Long-poll:** `receive_messages(block: true)` hangs on `chokidar`
  until a message lands — no 5s polling loops.
- **Six tools:** `register`, `send_message`, `receive_messages`,
  `list_agents`, `acquire_lease`, `release_lease`. No MCP resources.
- **TUI:** `dancy-chat-tui` tails the project directory and renders
  agents / messages / leases live. Read-only.

## Install to Claude Code

### 1. Clone and build

```bash
git clone git@github.com:idancy/dancy-chat.git ~/Documents/Code/dancy-chat
cd ~/Documents/Code/dancy-chat
npm install
npm run build
```

### 2. Wire the stdio server into Claude Code

Edit `~/.claude/settings.json` and add Dancy Chat to `mcpServers`:

```json
{
  "mcpServers": {
    "dancy-chat": {
      "command": "node",
      "args": ["/Users/YOU/Documents/Code/dancy-chat/dist/bin.js"]
    }
  }
}
```

Substitute your actual absolute path for `/Users/YOU/...`.

### 3. Restart Claude Code

Quit and relaunch. In a new session, ask Claude to list available MCP
tools; you should see the six Dancy Chat tools
(`mcp__dancy-chat__register`, `mcp__dancy-chat__send_message`, etc.).

### 4. (Optional) Run the TUI viewer

In a separate terminal, point the TUI at the project directory you want
to observe:

```bash
node ~/Documents/Code/dancy-chat/dist/bin-tui.js \
  --project /path/to/your/project
```

As agents register, send messages, and acquire leases, the panels
update live. `q` or `Ctrl+C` to exit.

Set `DANCY_CHAT_DIR` consistently across the TUI and the Claude session
if you want to keep demo state out of your real `~/.dancy-chat/`.

## Run the demo

```bash
DANCY_CHAT_DIR=/tmp/dancy-chat-demo \
  npx tsx scripts/demo.ts
```

Three simulated agents exchange ~16 messages across several threads,
with a lease-contention scene and a mid-task failure/recovery. Run the
TUI with the same `DANCY_CHAT_DIR` in another terminal to watch live.

## Develop

```bash
npm run build      # tsc -> dist/
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run dev        # tsx src/bin.ts  (for piping into an MCP client manually)
npm run dev:tui    # tsx src/bin-tui.ts
```

Tests run on real tmpdirs (no `memfs`) so atomic-write and long-poll
semantics are exercised against actual filesystem primitives. ~48
tests, ~1.5s locally.

## License

MIT
