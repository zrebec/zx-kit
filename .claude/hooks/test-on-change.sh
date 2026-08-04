#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook: run the vitest suite whenever a source or test
# file changes, so a regression surfaces at the edit that caused it.
#
# Exit 0 = silent pass. Exit 2 = blocking: the failing output is fed back to the
# agent. Anything the hook cannot do (no node, not a .ts file) exits 0 quietly —
# a hook that nags is a hook that gets switched off.
set -u

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

case "$file" in
  */src/*.ts | */tests/*.ts) ;;
  *) exit 0 ;;  # docs, config, anything else — nothing to verify
esac

# Hooks run without the user's shell profile, so a version-manager node is not on
# PATH (a stale homebrew `npm` shim may be, which then fails with "env: node: No
# such file or directory"). Resolve node first, and check for *node* — not npm.
if ! command -v node >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ] && . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1
fi
command -v node >/dev/null 2>&1 || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

if ! out=$(npm test --silent 2>&1); then
  printf '%s\n' "$out" | tail -40
  exit 2
fi
exit 0
