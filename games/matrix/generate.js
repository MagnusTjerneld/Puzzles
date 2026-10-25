// Generates 160 levels into levels.json: 40 each of easy, medium, hard and expert, each tier sorted by the engine's
// score. Expert is aimed at the hard end of a real matrix test: rules down the columns as well as along the rows,
// places that move round the frame and figures that turn, and four or five rules at once.
// Every level has exactly one answer among its eight that every rule accepts (Engine.accepts), and no two levels
// follow the same pattern of rules (signature).
// Run: node games/matrix/generate.js
const fs = require('fs');
const path = require('path');
const { generateLevel } = require('./engine.js');

// The rules each tier draws from (a rule listed twice is drawn twice as often). type: shapes, num: sizes and shades,
// n: how many, p: which places, l: lines; nShare: how often a grid's rule is about the count rather than the places.
const KINDS = {
  1: { type: ['dist', 'up1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist'], p: ['dist'], l: ['or'] },
  2: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist', 'add'], p: ['dist', 'or', 'xor'], l: ['xor', 'and', 'or', 'dist'] },
  3: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist', 'up1'], p: ['xor', 'and', 'or', 'dist', 'minus'], l: ['xor', 'and', 'minus', 'cw1', 'ccw1', 'cw2'] },
  4: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist'], p: ['cw1', 'ccw1', 'cw1', 'ccw1', 'cw2', 'xor'], l: ['cw1', 'ccw1', 'cw2', 'xor', 'and'], nShare: 0.3 },
};
// The chance, per attribute, that its rule runs down the columns instead of along the rows.
const COLS = { 1: 0, 2: 0, 3: 0, 4: 0.5 };
// [tier, layout, how many attributes vary]. A tier takes its 40 levels from its recipes in turn.
const plan = [
  [1, 'centre', 1], [1, 'centre', 2], [1, 'grid4', 1], [1, 'lines', 1], [1, 'lr', 1],
  [2, 'centre', 3], [2, 'grid4', 2], [2, 'grid9', 2], [2, 'lines', 1], [2, 'lr', 2], [2, 'oi', 2],
  [3, 'grid9', 3], [3, 'grid4', 3], [3, 'lr', 3], [3, 'lr', 4], [3, 'oi', 3], [3, 'oi', 4], [3, 'lines', 1], [3, 'centre', 3],
  [4, 'grid9', 3], [4, 'rc', 3], [4, 'rc', 4], [4, 'lines', 1], [4, 'oi', 4], [4, 'lr', 5],
];
const PER_TIER = 40;

// A level's pattern: the layout and which attributes follow which rule, which way. No two levels share one, in
// any tier: two levels that only differ in which shapes and shades they use are the same puzzle twice.
const signature = (lv) => lv.layout + ' ' + lv.rules.filter((r) => r.k !== 'const').map((r) => r.c + r.a + '=' + r.k + (r.d ? '|' + r.d : '')).sort().join(',');

const levels = [], seen = new Set();
for (const tier of [1, 2, 3, 4]) {
  const batch = [];
  // Each recipe keeps its own run of seeds. A recipe that finds no new pattern in TRIES seeds has run out and drops
  // out, and the others fill its place.
  const TRIES = 3000;
  const recipes = plan.filter((p) => p[0] === tier).map(([, layout, vary], pi) => ({ layout, vary, seed: 90000 + tier * 100000 + pi * 10000, done: false, got: 0 }));
  while (batch.length < PER_TIER) {
    const live = recipes.filter((rc) => !rc.done);
    if (!live.length) throw new Error(`tier ${tier}: only ${batch.length} different patterns`);
    for (const rc of live) {
      if (batch.length === PER_TIER) break;
      let lv = null;
      for (let k = 0; k < TRIES && !lv; k++) {
        const got = generateLevel({ seed: rc.seed++, layout: rc.layout, vary: rc.vary, kinds: KINDS[tier], cols: COLS[tier] });
        if (got && !seen.has(signature(got))) lv = got;
      }
      if (!lv) { rc.done = true; continue; }
      seen.add(signature(lv));
      batch.push(Object.assign({ tier }, lv));
      rc.got++;
    }
  }
  batch.sort((a, b) => a.score - b.score);
  levels.push(...batch);
  console.log(`tier ${tier}: ${batch.length} levels, score ${batch[0].score}..${batch[batch.length - 1].score}; ` + recipes.map((rc) => `${rc.layout}/${rc.vary} ${rc.got}`).join(', '));
}
const out = levels.map((lv, i) => ({ id: i + 1, tier: lv.tier, score: lv.score, layout: lv.layout, cells: lv.cells, options: lv.options, answer: lv.answer, rules: lv.rules }));
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels,', (JSON.stringify(out).length / 1024).toFixed(0), 'kB');
