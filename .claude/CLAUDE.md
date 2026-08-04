# CLAUDE.md

@../AGENTS.md

`AGENTS.md` is the single source of truth for this project and is shared with every AI
agent. Write what you learn **there**, not here.

This file is only for things Claude Code has that no other agent does — and that means
*less* than it looks, because the harness configures itself in files that are already
machine-readable:

- `.claude/settings.json` — pre-approved test/build commands, denied commands, and the
  `PostToolUse` hook that runs the suite after any `src/` or `tests/` edit.
- `.claude/hooks/test-on-change.sh` — that hook, with its reasoning in its own header.

Read those two files directly when you need them; do not restate their contents here.
