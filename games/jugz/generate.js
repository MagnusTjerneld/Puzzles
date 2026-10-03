// Level generator for Jugz: writes levels.json with 150 levels following a difficulty curve.
// Seeded, so the bank is reproducible: changing SEED reshuffles every level and reattributes saved progress.
// Run: node games/jugz/generate.js
const fs = require('fs');
const path = require('path');
const { bfs, solveFrom } = require('./engine.js');

// Every candidate: capacities a > b > c, start = the biggest jug full, goal = an amount in any jug, at least 2 pours away.
function candidates() {
  const out = [];
  for (let a = 5; a <= 19; a++) for (let b = 2; b < a; b++) for (let c = 1; c < b; c++) {
    const caps = [a, b, c];
    const dist = bfs(caps, [a, 0, 0]);
    const minFor = new Map();
    for (const [k, d] of dist) {
      for (const v of k.split(',').map(Number)) {
        if (v > 0 && v < a && (!minFor.has(v) || d < minFor.get(v))) minFor.set(v, d);
      }
    }
    for (const [g, m] of minFor) if (m >= 2) out.push({ caps, goal: g, opt: m });
  }
  return out;
}

// Seeded PRNG so the level bank is reproducible.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEED = 20260819;
const rng = mulberry32(SEED);
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

const cands = candidates();
const byOpt = new Map();
for (const c of cands) { if (!byOpt.has(c.opt)) byOpt.set(c.opt, []); byOpt.get(c.opt).push(c); }
for (const arr of byOpt.values()) shuffle(arr);
console.log('Candidates per opt:', [...byOpt.entries()].sort((a, b) => a[0] - b[0]).map(([m, a]) => m + ':' + a.length).join(' '));

// Curve: 15 blocks of 10 levels. A rising baseline, with breathers (-) and spikes (+) in every block.
const base = [2, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12, 12];
const offsets = [0, 0, 1, -1, 1, 0, 2, -2, 1, 3]; // position 8 = a late breather, position 10 = the block's "boss"
const targets = [];
for (let c = 0; c < base.length; c++) for (const o of offsets) targets.push(Math.max(2, Math.min(14, base[c] + o)));

const usedPuzzle = new Set();
const levels = [];
for (const t of targets) {
  let picked = null;
  outer:
  for (const dt of [0, 1, -1, 2, -2, 3, -3]) {
    const m = t + dt; if (m < 2) continue;
    for (const c of byOpt.get(m) || []) {
      const pk = c.caps.join('-') + ':' + c.goal;
      if (usedPuzzle.has(pk)) continue;
      if (levels.slice(-4).some((l) => l.caps.join('-') === c.caps.join('-'))) continue;
      picked = c; usedPuzzle.add(pk); break outer;
    }
  }
  if (!picked) { console.error('Out of candidates for opt ' + t); process.exit(1); }
  levels.push(picked);
}

// Check every level with the solver the game uses for Hint.
let bad = 0;
for (const l of levels) {
  const p = solveFrom(l.caps, [l.caps[0], 0, 0], l.goal);
  if (!p || p.length !== l.opt) { bad++; console.error('BAD:', JSON.stringify(l)); }
}
if (bad) { console.error(bad + ' broken levels'); process.exit(1); }

const out = levels.map((l, i) => ({ id: i + 1, caps: l.caps, goal: l.goal, opt: l.opt }));
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels');
for (let c = 0; c < 15; c++) console.log('  levels ' + String(c * 10 + 1).padStart(3) + '-' + String(c * 10 + 10).padStart(3) + ':', levels.slice(c * 10, c * 10 + 10).map((l) => String(l.opt).padStart(2)).join(' '));
