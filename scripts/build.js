// Builds the site from source: index.html (shell, grid kit and every game in one file, levels inlined) and sw.js
// (a cache version that changes whenever any precached file changes). Run: node scripts/build.js
// SITE_URL (set in Actions) makes og:url and og:image absolute, which link previews require. Without it they are relative.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
// The games, in hub order. Each folder holds engine.js, game.js, game.css, levels.json and logo.svg.
const GAMES = ['queens', 'tango'];
const DESCRIPTION = 'Logic puzzles for phone and browser: Queens and Tango. Plays offline.';

let site = process.env.SITE_URL || '';
if (site && !site.endsWith('/')) site += '/';

// The version on the hub: build date and commit, so it is easy to see which build is running.
let appVersion = new Date().toISOString().slice(0, 10);
try {
  const sha = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const dirty = execSync('git status --porcelain', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  appVersion += ' · ' + sha + (dirty ? '-dirty' : '');
} catch (e) {}

// Placeholders are replaced in order with split/join, so "$&" and friends in the inserted code are taken literally.
const fill = (s, map) => Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), s);

const css = [read('src', 'shell', 'shell.css'), read('src', 'grid', 'grid.css')]
  .concat(GAMES.map((g) => read('games', g, 'game.css'))).join('\n');

// Each game runs in its own function scope, with its engine's exports as Engine, so games never share names.
const gameJs = GAMES.map((g) => {
  const levels = JSON.parse(read('games', g, 'levels.json'));
  const body = fill(read('games', g, 'game.js'), {
    __LEVELS__: JSON.stringify(levels),
    __LOGO__: JSON.stringify(read('games', g, 'logo.svg').trim()),
  });
  console.log(`${g}: ${levels.length} levels`);
  return `// ===== ${g} =====\n;(function () {\nconst Engine = (function () {\nconst module = { exports: {} };\n${read('games', g, 'engine.js')}\nreturn module.exports;\n})();\n${body}\n})();`;
});
const js = [read('src', 'shell', 'shell.js'), read('src', 'grid', 'grid.js'), ...gameJs, 'Puzzles.start();'].join('\n');

const html = fill(read('src', 'shell', 'index.html'), {
  // The small placeholders first, so they are never looked for inside the inserted CSS and code.
  __DESCRIPTION__: DESCRIPTION, __SITE_URL__: site, __APP_VERSION__: 'Version ' + appVersion, __CSS__: css, __JS__: js,
});
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} kB, version ${appVersion}` + (site ? `, address ${site}` : ', no SITE_URL'));

// The PNG icons need playwright (scripts/build-icons.js). If they are missing locally they are skipped; in Actions they are always built first.
const icons = fs.existsSync(path.join(root, 'icons')) ? fs.readdirSync(path.join(root, 'icons')).filter((f) => f.endsWith('.png') && f !== 'og.png').map((f) => 'icons/' + f) : [];
if (!icons.length) console.warn('warning: no PNG icons, run node scripts/build-icons.js');
const assets = ['index.html', 'manifest.webmanifest', 'icons/icon.svg', ...icons.sort()]
  .concat(fs.readdirSync(path.join(root, 'fonts')).map((f) => 'fonts/' + f));
const hash = crypto.createHash('sha256');
for (const a of assets) hash.update(a).update(fs.readFileSync(path.join(root, a)));
const version = hash.digest('hex').slice(0, 12);
const files = ['./'].concat(assets.filter((a) => a !== 'index.html'));
fs.writeFileSync(path.join(root, 'sw.js'), fill(read('src', 'sw.template.js'), { __VERSION__: version, __FILES__: JSON.stringify(files, null, 2) }));
console.log(`sw.js version ${version}`);
