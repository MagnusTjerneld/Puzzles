# Puzzles

Logic puzzles for phone and browser, in one installable app that plays offline:

- **Queens**: one queen in every row, column and colour region, and no two queens touching, not even diagonally.
- **Tango**: fill the board with suns and moons. As many of each in every row and column, never three alike in a row; `=` means the same, `×` means different.

Every level has exactly one solution and can be solved by logic alone. **Hint** shows the next logical step and explains it.

Play: https://magnustjerneld.github.io/Puzzles/ (each game also has its own link, `…/Puzzles/#queens` and `…/Puzzles/#tango`).

## Install as an app (PWA)

- Android/Chrome: menu → Install app. Long-press the icon for a shortcut straight into each game.
- iPhone/Safari: Share → Add to Home Screen.

A service worker precaches the page, icons and fonts on the first visit. Online, a new release shows on the next load; offline, the cached copy starts.

## Layout

| Path | What |
|---|---|
| `src/shell/` | The shell: `index.html` (page template), `shell.css`, `shell.js` (hub, routing, header, clock, level picker, rules sheet, status, hint text, undo/redo, saved progress) |
| `src/grid/` | Grid kit shared by grid puzzles: the canvas board with a button per cell, hint and clash marks, example boards for the rules |
| `games/<id>/` | One folder per game: `engine.js` (generator and solver, also used in Node), `game.js` (the game in the shell), `game.css`, `levels.json`, `logo.svg` (hub card), `icon.svg` (shortcut icon), `generate.js`, `verify.py` |
| `src/sw.template.js` | Service worker; `scripts/build.js` fills in the version and the file list |
| `scripts/build.js` | Builds `index.html` (everything inlined, one file) and `sw.js` |
| `scripts/build-icons.js` | Renders `icons/*.svg` and each game's `icon.svg` to PNG (needs playwright) |
| `test/hints.test.js` | Follows Hint through every level of every grid game in a headless browser |
| `manifest.webmanifest` | App name, icons and the per-game shortcuts. It deliberately has **no `id`**, see below |

`index.html`, `sw.js` and the PNG icons are built, not checked in. `.github/workflows/pages.yml` builds, checks and publishes on every push to `main`.

## Commands

```bash
python3 games/queens/verify.py   # independent check of the levels (likewise games/tango/verify.py)
node scripts/build-icons.js      # PNG icons and link preview (needs playwright)
node scripts/build.js            # index.html and sw.js
node test/hints.test.js          # follow Hint through every level (needs playwright and a built index.html)
node games/queens/generate.js    # regenerate a game's levels (slow; changes the level bank)
python3 -m http.server           # serve the parent folder and open /puzzles/ to test the service worker
```

## Manifest id

The manifest has no `id`. Chrome resolves `id` against the **origin**, not the manifest's folder, so `"id": "./"` becomes `https://magnustjerneld.github.io/` and clashes with every other app on that origin: Chrome then says the app is already installed. Without `id`, the app's identity is `start_url`, which resolves to `…/Puzzles/`.

## Link preview

`og:image` must be an absolute address. The build uses `https://<owner>.github.io/<repo>/`; for a custom domain, set the repository variable `SITE_URL` (Settings → Secrets and variables → Actions → Variables).
