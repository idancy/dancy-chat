#!/usr/bin/env bash
#
# Dancy Chat installer. Idempotent, non-interactive, no sudo.
#
#   curl -fsSL https://raw.githubusercontent.com/idancy/dancy-chat/main/install.sh | bash
#
# Custom checkout location:
#
#   DANCY_CHAT_SRC=~/code/dancy-chat curl -fsSL https://... | bash
#
# Re-run at any time to update: pulls the latest, rebuilds, relinks.

set -euo pipefail

REPO_URL="https://github.com/idancy/dancy-chat.git"
SRC_DIR="${DANCY_CHAT_SRC:-$HOME/.local/share/dancy-chat}"

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
info() { printf '%s %s\n' "$(color '1;34' '▌')" "$*"; }
ok()   { printf '%s %s\n' "$(color '1;32' '✓')" "$*"; }
err()  { printf '%s %s\n' "$(color '1;31' '✗')" "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "required command not found: $1"
    err "$2"
    exit 1
  fi
}

require_cmd node "install Node 20+ from https://nodejs.org or via nvm: https://github.com/nvm-sh/nvm"
require_cmd npm  "npm ships with Node — reinstall Node if it is missing"
require_cmd git  "install git via Xcode command line tools: xcode-select --install"

NODE_VERSION=$(node -v)
NODE_MAJOR=$(printf '%s' "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node 20+ required (found $NODE_VERSION)"
  err "upgrade via nvm: nvm install 20 && nvm use 20"
  exit 1
fi

info "Node $NODE_VERSION, npm $(npm -v), git $(git --version | awk '{print $3}')"

if [ -d "$SRC_DIR/.git" ]; then
  info "updating $SRC_DIR"
  git -C "$SRC_DIR" fetch --quiet origin
  git -C "$SRC_DIR" checkout --quiet main
  git -C "$SRC_DIR" pull --ff-only --quiet
else
  info "cloning $REPO_URL into $SRC_DIR"
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --quiet "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"

info "installing dependencies"
npm install --silent --no-progress

info "building"
npm run build --silent

# Install bins into a user-writeable prefix so we never need sudo. The
# default (~/.local) matches the XDG-ish convention used by rustup,
# deno, pipx, etc. Override with DANCY_CHAT_PREFIX.
BIN_PREFIX="${DANCY_CHAT_PREFIX:-$HOME/.local}"
BIN_DIR="$BIN_PREFIX/bin"
mkdir -p "$BIN_PREFIX/lib" "$BIN_DIR"

info "installing bins into $BIN_DIR"
# --install-links is critical: without it, npm symlinks the global
# package into the source dir. If the user later deletes or moves the
# source, every bin goes with it. --install-links packs dist/ and
# copies, so the install is self-contained.
npm install -g . --silent --no-progress --install-links --prefix="$BIN_PREFIX"

# Verify and, if needed, tell the user how to put BIN_DIR on PATH.
if [ ! -x "$BIN_DIR/dancy-chat" ] || [ ! -x "$BIN_DIR/dancy-chat-tui" ]; then
  err "expected bins were not created at $BIN_DIR"
  exit 1
fi

case ":$PATH:" in
  *":$BIN_DIR:"*)
    : # already on PATH
    ;;
  *)
    err "$BIN_DIR is not on your PATH."
    err "add this to your shell profile (zsh: ~/.zshrc, bash: ~/.bashrc):"
    err ""
    err "  export PATH=\"$BIN_DIR:\$PATH\""
    err ""
    err "then open a new terminal and run 'dancy-chat --version' to confirm."
    exit 1
    ;;
esac

ok "installed: $BIN_DIR/dancy-chat"
ok "installed: $BIN_DIR/dancy-chat-tui"

cat <<-MSG

$(color '1;32' 'Dancy Chat is installed.')

Next steps:

1. Add to ~/.claude/settings.json:

     {
       "mcpServers": {
         "dancy-chat": {
           "command": "dancy-chat"
         }
       }
     }

2. Restart Claude Code. In a fresh session, ask it to list tools —
   the six mcp__dancy-chat__* tools should appear.

3. (Optional) View coordination state live from any project:

     dancy-chat-tui --project /path/to/your/project

Source lives at $SRC_DIR. Re-run this installer any time to update:

  curl -fsSL https://raw.githubusercontent.com/idancy/dancy-chat/main/install.sh | bash

MSG
