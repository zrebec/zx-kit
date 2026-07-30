# Known issues

No confirmed open issues.

Known limitations (by design, documented elsewhere):

- **Singleton state** — `audio.ts`, `ay.ts`, and `input.ts` hold module-level state; the kit
  is not suitable for multiple game instances on the same page (see Architecture constraints
  in the README).
- **Save signature is deterrence, not security** — the optional envelope signature stops
  casual localStorage edits, not a determined user (see `docs/save.md`).
- **`npm audit` reports dev-only findings inside a bundled npm CLI** — the chain is
  `semantic-release` → `@semantic-release/npm` → `npm` → `tar` / `brace-expansion`, all of it
  under `node_modules/npm/node_modules/`. zx-kit has no runtime dependencies
  (`dependencies: {}`) and publishes only `dist/`, so nothing here can reach a consumer:
  `npm audit --omit=dev` reports **0**. GitHub Dependabot classifies these as `development`
  scope and auto-dismisses them. `npm audit fix` is a no-op (the fix path leads back inside
  the bundled CLI) and `npm audit fix --force` would **downgrade** `@semantic-release/npm`,
  risking the release pipeline to silence a DoS advisory in a tool that only runs in CI.
  **Do not "fix" this — wait for the upstream bump.** Second occurrence of the same pattern
  (2026-07: `tar`/`brace-expansion`; earlier: `undici`), so treat it as expected noise.
