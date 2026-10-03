# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Puzzles: several logic puzzles (Queens, Tango) in one installable PWA, published to GitHub Pages at `/Puzzles/`. No runtime dependencies and no bundler: `scripts/build.js` inlines the shell, the grid kit and every game into a single `index.html`. Playwright is only needed for the icons and the tests.

All user-facing text, comments and identifiers are English. British spelling in UI text ("colour").

## Architecture

Three layers:

1. **Shell** (`src/shell/`): the hub (one card per game), hash routing (`#queens`), and everything around a game: header (home, level, clock and best time, rules, level picker), the square stage, status row, the "Why" hint text, the button bar (Undo, Redo, Hint, Restart), the rules sheet, the clock and saved progress. The interface a game implements is documented at the top of `src/shell/shell.js`.
2. **Grid kit** (`src/grid/`): for n x n grid puzzles. `Grid.build/fit/cellAt` draw the board on a canvas in whole device pixels (so every line has the same thickness at any density) with a transparent button per cell; `Grid.mini` draws the small example boards in the rules. A game that is not a grid (a planned one is Jugz, the water-jug puzzle) skips the kit and draws into its board element any way it likes; the stage is always square.
3. **Games** (`games/<id>/`): `engine.js` is plain JS that also runs in Node (generator, solver; `module.exports`). The build wraps each game in its own function scope with the engine's exports as `Engine`, so games never share names. `game.js` holds the game's state in that scope and calls `Puzzles.register({...})`. `game.css` scopes its rules with `body[data-game="<id>"]` (tokens) and `[data-for="<id>"]` (its board).

Adding a game: a new folder with the files above, its id in `GAMES` in `scripts/build.js`, a shortcut in `manifest.webmanifest`, a `CHECKS` entry in `test/hints.test.js` if it has hints, and a mention in the description strings (build.js, manifest, README, og.svg).

### State and undo

The game owns its state; the shell owns the undo and redo stacks of opaque `snapshot()`s. Every player action goes through `ctx.change(fn)` (one undo step), or `ctx.record(before)` after an in-place change such as a drag. `ctx.refresh()` repaints without an undo step. After every change the shell calls `render()`, then `solved()` and `status()`.

When the player switches games, the shell keeps the old game's session (level, stacks, clock) and the game keeps its state in its own scope, so coming back resumes mid-level. Reloading the page starts the saved level from scratch.

### Progress

Stored in `localStorage` per game: `<id>.solved` (`{ levelId: best seconds }`), `<id>.cur` (level index) and `<id>.rulesSeen`. These are the keys the standalone Queens and Tango apps used; they lived on the same origin (`magnustjerneld.github.io`), so players kept their progress when the games moved in here. Do not rename them. Level ids are positions in `levels.json`; regenerating a level bank reattributes saved times.

## PWA

- The manifest has **no `id`**: Chrome resolves `id` against the origin, so `"id": "./"` would clash with every other app on `magnustjerneld.github.io` ("already installed"). Without it the identity is `start_url`, i.e. `/Puzzles/`.
- Every path is relative: the site lives in a subfolder.
- `sw.js`: navigation races the network against a 2 s timeout and falls back to the cached page, so a release shows on the next load while online and the app still starts offline. Other files are precached and served cache first; the cache name carries a hash of all of them, so any change makes a new cache and deletes the old.

## Checks

```bash
python3 games/<id>/verify.py   # independent check of a level bank (CI)
node scripts/build-icons.js    # needs playwright
node scripts/build.js
node test/hints.test.js        # follows Hint through all levels of every grid game (CI)
```

In this cloud environment playwright is global: prefix node with `NODE_PATH=/opt/node22/lib/node_modules`. Test layout changes in a real browser at phone sizes in both orientations (320x640, 360x740, 390x844, 667x375, 844x390): the header row is tight and has overflowed before.
