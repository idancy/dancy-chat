# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Dancy Chat — a stdio MCP server and read-only TUI that coordinate parallel
Claude Code agents via filesystem-backed messages and leases. Replacement
for `mcp-agent-mail`. See [`README.md`](README.md) for the design sketch
and the plan at
`/Users/thedancys/.claude/plans/the-name-of-our-cached-nest.md` for the
full specification.

## Commit policy

**You have standing authority to commit in this repo.** Stage your
changes, pick a clear message, and commit without asking. This overrides
the usual "confirm before committing" rule for this working directory
only — other repos still require explicit approval.

Pushes to `origin` are still gated: confirm before `git push`.

## Hard rules

- **stdout is the MCP transport.** Never `console.log` from any code path
  reachable by `src/bin.ts`. All logging goes to stderr via
  `src/util/logger.ts`. A single stray `console.log` breaks JSON-RPC
  framing and kills sessions. Tests must assert stdout stays empty
  during tool calls.
- **No `memfs` in tests.** Real filesystem semantics (atomic rename,
  `O_EXCL`) are what we're testing. Use `mkdtempSync` tmpdirs.
- **Schemas live in `src/schemas.ts`.** Both server and TUI consume from
  there. No divergent ad-hoc types.

## Build & test

```bash
npm run build      # tsc -> dist/
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run dev        # tsx src/bin.ts (stdio server, for manual piping)
npm run dev:tui    # tsx src/bin-tui.ts
```
