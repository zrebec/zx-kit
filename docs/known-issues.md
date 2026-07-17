# Known issues

No confirmed open issues.

Known limitations (by design, documented elsewhere):

- **Singleton state** — `audio.ts`, `ay.ts`, and `input.ts` hold module-level state; the kit
  is not suitable for multiple game instances on the same page (see Architecture constraints
  in the README).
- **Save signature is deterrence, not security** — the optional envelope signature stops
  casual localStorage edits, not a determined user (see `docs/save.md`).
