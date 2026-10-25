// Generates 160 levels into levels.json: 40 each of easy, medium, hard and expert, each tier sorted by the engine's
// score. Expert is aimed at the hard end of a real matrix test: rules down the columns as well as along the rows,
// places that move round the frame and figures that turn, and four or five rules at once.
// Every level has exactly one answer among its eight that every rule accepts (Engine.accepts).
// Run: node games/matrix/generate.js
const fs = require('fs');
const path = require('path');
const { generateLevel } = require('./engine.js');

// The rules each tier draws from (a rule listed twice is drawn twice as often). type: shapes, num: sizes and shades,
// n: how many, p: which places, l: lines; nShare: how often a grid's rule is about the count rather than the places.
const KINDS = {
  1: { type: ['dist', 'up1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist'], p: ['dist'], l: ['or'] },
  2: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist', 'add'], p: ['dist', 'or', 'xor'], l: ['xor', 'and', 'or', 'dist'] },
  3: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist', 'up1'], p: ['xor', 'and', 'or', 'dist'], l: ['xor', 'and'] },
  4: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist'], p: ['cw1', 'ccw1', 'cw1', 'ccw1', 'cw2', 'xor'], l: ['cw1', 'ccw1', 'cw2', 'xor', 'and'], nShare: 0.3 },
};
// The chance, per attribute, that its rule runs down the columns instead of along the rows.
const COLS = { 1: 0, 2: 0, 3: 0, 4: 0.5 };
// [tier, layout, how many attributes vary, count]
const plan = [
  [1, 'centre', 1, 14], [1, 'centre', 2, 10], [1, 'grid4', 1, 8], [1, 'lines', 1, 4], [1, 'lr', 1, 4],
  [2, 'centre', 3, 6], [2, 'grid4', 2, 6], [2, 'grid9', 2, 8], [2, 'lines', 1, 8], [2, 'lr', 2, 6], [2, 'oi', 2, 6],
  [3, 'grid9', 3, 8], [3, 'grid4', 3, 5], [3, 'lr', 3, 4], [3, 'lr', 4, 4], [3, 'oi', 3, 4], [3, 'oi', 4, 4], [3, 'lines', 1, 6], [3, 'centre', 3, 5],
  [4, 'grid9', 3, 8], [4, 'rc', 3, 6], [4, 'rc', 4, 6], [4, 'lines', 1, 6], [4, 'oi', 4, 7], [4, 'lr', 5, 7],
];

const levels = [], seen = new Set();
for (const tier of [1, 2, 3, 4]) {
  const batch = [];
  plan.filter((p) => p[0] === tier).forEach(([, layout, vary, count], pi) => {
    let seed = 90000 + tier * 10000 + pi * 1000, got = 0, guard = 0;
    while (got < count && guard++ < 5000) {
      const lv = generateLevel({ seed: seed++, layout, vary, kinds: KINDS[tier], cols: COLS[tier] });
      if (!lv) continue;
      const key = JSON.stringify([lv.cells, lv.options]);
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push(Object.assign({ tier }, lv));
      got++;
    }
    if (got < count) throw new Error(`only ${got} of ${count} levels for tier ${tier}, ${layout}, vary ${vary}`);
  });
  batch.sort((a, b) => a.score - b.score);
  levels.push(...batch);
  console.log(`tier ${tier}: ${batch.length} levels, score ${batch[0].score}..${batch[batch.length - 1].score}`);
}
const out = levels.map((lv, i) => ({ id: i + 1, tier: lv.tier, score: lv.score, layout: lv.layout, cells: lv.cells, options: lv.options, answer: lv.answer, rules: lv.rules }));
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels,', (JSON.stringify(out).length / 1024).toFixed(0), 'kB');
