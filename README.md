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

## Install

One line, no sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/idancy/dancy-chat/main/install.sh | bash
```

Requires Node 20+, npm, and git. The installer clones the repo to
`~/.local/share/dancy-chat`, builds it, and installs `dancy-chat` and
`dancy-chat-tui` into `~/.local/bin`. Re-run any time to update.

Environment overrides:

- `DANCY_CHAT_SRC` — where the source clone lives (default:
  `~/.local/share/dancy-chat`)
- `DANCY_CHAT_PREFIX` — where to install bins (default: `~/.local`)

### Wire into Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "dancy-chat": {
      "command": "dancy-chat"
    }
  }
}
```

Restart Claude Code. In a fresh session, ask it to list available MCP
tools — the six `mcp__dancy-chat__*` tools should appear.

### Use the TUI

In any terminal, point the viewer at the project you want to observe:

```bash
dancy-chat-tui --project /path/to/your/project
```

Agents, messages, and leases update live as Claude sessions coordinate.
`q` or `Ctrl+C` to exit.

## Demo

Three simulated agents exchange ~16 messages across several threads,
including lease contention and a mid-task failure and recovery:

```bash
# terminal 1 — viewer
DANCY_CHAT_DIR=/tmp/dancy-chat-demo dancy-chat-tui --project /tmp/demo

# terminal 2 — driver
DANCY_CHAT_DIR=/tmp/dancy-chat-demo \
  npx tsx ~/.local/share/dancy-chat/scripts/demo.ts
```

## Install from source (for development)

```bash
git clone git@github.com:idancy/dancy-chat.git
cd dancy-chat
npm install
npm run build
npm link     # alternative to install.sh; symlinks ./dist/ so rebuilds
             # take effect without reinstalling
```

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
