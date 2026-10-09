# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Puzzles: several logic puzzles (Queens, Tango, Jugz) in one installable PWA, published to GitHub Pages at `/Puzzles/`. No runtime dependencies and no bundler: `scripts/build.js` inlines the shell, the grid kit and every game into a single `index.html`. Playwright is only needed for the icons and the tests.

All user-facing text, comments and identifiers are English. British spelling in UI text ("colour").

## Architecture

Three layers:

1. **Shell** (`src/shell/`): the hub (one card per game), hash routing (`#queens`), and everything around a game: header (home, level, clock and best time, rules, level picker), the square stage, status row, the "Why" hint text, the button bar (Undo, Redo, Hint, Restart), the rules sheet, the clock and saved progress. The interface a game implements is documented at the top of `src/shell/shell.js`.
2. **Grid kit** (`src/grid/`): for n x n grid puzzles. `Grid.build/fit/cellAt` draw the board on a canvas in whole device pixels (so every line has the same thickness at any density) with a transparent button per cell; `Grid.mini` draws the small example boards in the rules. A game that is not a grid (Jugz) skips the kit and draws into its board element any way it likes; the stage is always square. `Rules.card` (in the shell) is the rules card for every game.
3. **Games** (`games/<id>/`): `engine.js` is plain JS that also runs in Node (rules, solver; `module.exports`). The build wraps each game in its own function scope with the engine's exports as `Engine`, so games never share names; any other `.js` in the folder (`generate.js` aside) is included in that scope before `game.js`. `game.js` holds the game's state and calls `Puzzles.register({...})`. `game.css` scopes its rules with `body[data-game="<id>"]` (tokens) and `[data-for="<id>"]` (its board); a game's tokens must not reuse the shell's names (`--panel`, `--accent`, ...).

Adding a game: a new folder with the files above, its id in `GAMES` in `scripts/build.js`, a shortcut in `manifest.webmanifest`, an entry in `GAMES` in `test/hints.test.js`, and a mention in the description strings (build.js, manifest, README, og.svg).

### State and undo

The game owns its state; the shell owns the undo and redo stacks of opaque `snapshot()`s. Every player action goes through `ctx.change(fn)` (one undo step), or `ctx.record(before)` after an in-place change such as a drag. `ctx.refresh()` repaints without an undo step. After every change the shell calls `render()`, then `solved()` and `status()`.

When the player switches games, the shell keeps the old game's session (level, stacks, clock) and the game keeps its state in its own scope, so coming back resumes mid-level. The level in play is also saved to `localStorage` (`<id>.play`: snapshot, undo and redo stacks, clock; written after every change and on `pagehide`), so closing the app or reloading resumes it too. Snapshots must therefore be JSON-serialisable. A saved play is dropped when the level is solved or untouched, or when its shape no longer fits the level.

### Progress

Stored in `localStorage` per game: `<id>.solved` (`{ levelId: best seconds }`, or `null` for solved without a time), `<id>.cur` (level index), `<id>.rulesSeen` and `<id>.play` (the unfinished level). These are the keys the standalone Queens and Tango apps used; they lived on the same origin (`magnustjerneld.github.io`), so players kept their progress when the games moved in here. Do not rename them. Level ids are positions in `levels.json`; regenerating a level bank reattributes saved progress. Once ten levels are solved in total, the shell asks for persistent storage (`askPersist`).

## Jugz

Moved in from the standalone Jugz (`MagnusTjerneld/Jugz`, now only a redirect). Its CLAUDE.md, with the long reasoning behind the vessels, is kept as `games/jugz/NOTES.md`; the parts that are load-bearing here:

- **Progress**: the standalone app saved `{ current, stars: { levelIndex: n }, skin }` under `jugz_v1`. `game.js` migrates it once into `jugz.solved` (ids are index + 1, times unknown so `null`), `jugz.stars`, `jugz.cur` and `jugz.skin`, and sets `jugz.migrated`. `games/jugz/generate.js` reproduces the old bank exactly (seed 20260819); changing the seed reattributes stars.
- **Rules of play**: `Engine.pours` defines a pour (until the source is empty or the target full). Stars: 3 at `moves <= opt`, 2 within two more, else 1. Undo takes a pour back off the count. Levels unlock in order (`locked`). The optimum is shown only after a level has been solved (`status`), because the length of the solution is a large part of the puzzle. Hint gives the first pour of `Engine.solveFrom` and says which jugs.
- **Vessels** (`vessels.js`): every generator publishes its liquid band (`data-top`/`data-bot`) and surface profile (`data-cx/-rx/-ry/-prof`) on its `<svg>` and emits the same element ids, so `render()` is skin-blind. A new vessel owes both. Element ids (`water<i>`, `surfg<i>`, ...) are global: no other game may use them.
- **Skins**: water, wine (Winez, `U`) and beer (Beerz, `S` for Seidel). The tokens are in `game.css` under `body[data-skin]`; the words in the tables at the top of `game.js`. The switch is hidden: three taps on the wordmark in the board's corner, a chain of taps each within 900 ms, on `pointerdown` (iOS withholds `click` from an element without `cursor:pointer`). The hub, manifest and icons stay "Jugz".
- **Board**: the shell's square stage; the goal line across the top and the vessels scaled to fill the rest (`fit`). Text on the board uses container units, because the board is as small as 216 px on a small phone held sideways.

## PWA

- The manifest has **no `id`**: Chrome resolves `id` against the origin, so `"id": "./"` would clash with every other app on `magnustjerneld.github.io` ("already installed"). Without it the identity is `start_url`, i.e. `/Puzzles/`.
- Every path is relative: the site lives in a subfolder.
- `sw.js`: navigation races the network against a 2 s timeout and falls back to the cached page, so a release shows on the next load while online and the app still starts offline. Other files are precached and served cache first; the cache name carries a hash of all of them, so any change makes a new cache and deletes the old.

## Checks

```bash
python3 games/<id>/verify.py   # independent check of a level bank (CI)
node scripts/build-icons.js    # needs playwright
node scripts/build.js
node test/hints.test.js        # follows Hint through all levels of every game (CI); Jugz must take exactly the optimum
```

In this cloud environment playwright is global: prefix node with `NODE_PATH=/opt/node22/lib/node_modules`. Test layout changes in a real browser at phone sizes in both orientations (320x640, 360x740, 390x844, 667x375, 844x390): the header row is tight and has overflowed before.
