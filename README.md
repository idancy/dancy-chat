# Dancy Chat

Stdio MCP server and read-only TUI for coordinating parallel Claude Code
agents via filesystem-backed messages and leases. Replacement for
`mcp-agent-mail` with an ~80% smaller surface.

## Status

Early development. See plan:
`/Users/thedancys/.claude/plans/the-name-of-our-cached-nest.md`.

## Design sketch

- **Transport:** stdio (no HTTP daemon, spawned per Claude session).
- **Storage:** flat JSON files under `~/.dancy-chat/` (override with
  `DANCY_CHAT_DIR`). Atomic writes via `O_EXCL` and rename-CAS.
- **Long-poll:** `receive_messages(block: true)` hangs on `chokidar`
  until a message lands — no 5s polling loops.
- **Six tools:** `register`, `send_message`, `receive_messages`,
  `list_agents`, `acquire_lease`, `release_lease`. No MCP resources.
- **TUI:** `dancy-chat-tui` tails the project directory and renders
  agents / messages / leases live. Read-only.

## Build

```bash
npm install
npm run build
npm test
```

## License

MIT
