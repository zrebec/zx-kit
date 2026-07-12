# High-Score Table (hiscore)

A canvas-rendered Hall of Fame over the `hiscore` module (0.38):

- **Finish a run** — a random score goes through `isHighScore` (the cheap
  pre-check a game runs before asking for a name) and `insertScore` (top-N,
  best first, stable on ties). The entry carries a game-specific `level`
  field — the `Extra` type parameter with its `validateExtra` guard.
- **Cheat in localStorage** — the button does exactly what a cheater does in
  DevTools: bumps the stored top score to 999999. The table is created with a
  `secret`, so the envelope signature no longer matches and the whole table
  loads as **empty** — the cheat wipes the board instead of topping it.
  (Deterrence, not security: the secret ships in the bundle.)
- **Clear** — `clearHighScores`.

The kit owns the data; the look (this table), the name entry and the extra
fields are the game's. Minefield's `{ level, date? }` shape is the reference
consumer.

## Run

Build zx-kit first so `dist/` exists:

```bash
npm run build
```

Then serve the repository root with any static server and open:

```text
examples/hiscore/index.html
```
