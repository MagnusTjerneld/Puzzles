// Generates 100 levels into levels.json: 75 at 6x6 and 25 at 8x8, in order of difficulty: first 6x6 (easy, medium, hard),
// then 8x8, and within each tier sorted by the solver's score.
// Every level has exactly one solution and can be solved by pure logic. Run: node games/tango/generate.js
const fs = require('fs');
const path = require('path');
const { generateLevel } = require('./engine.js');

// [size, tier (null = any), count, maxExtra]
const plan = [
  [6, 1, 20, 14], [6, 2, 35, 6], [6, 3, 20, 2],
  [8, 2, 10, 6], [8, 3, 15, 2],
];
const levels = [];
for (const [n, tier, count, maxExtra] of plan) {
  const batch = [], seen = new Set();
  let seed = 70000 + n * 1000 + (tier || 0) * 100;
  let guard = 0;
  while (batch.length < count && guard++ < count * 400) {
    const lv = generateLevel({ n, tier, seed: seed++, maxAttempts: 200, maxExtra });
    if (!lv) continue;
    const key = [lv.given.join(''), lv.h.join(''), lv.v.join('')].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push(lv);
  }
  if (batch.length < count) throw new Error(`only ${batch.length} of ${count} levels for ${n}x${n}, tier ${tier}`);
  batch.sort((a, b) => a.score - b.score);
  levels.push(...batch);
  console.log(`${n}x${n} tier ${tier == null ? 'any' : tier}: ${batch.length} levels, score ${batch[0].score}..${batch[batch.length - 1].score}`);
}
const out = levels.map((lv, i) => ({ id: i + 1, n: lv.n, tier: lv.tier, score: lv.score, given: lv.given, h: lv.h, v: lv.v, solution: lv.solution }));
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels');
