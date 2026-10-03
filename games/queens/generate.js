// Generates 100 levels into levels.json: 20 at 6x6, 25 at 7x7, 30 at 8x8 and 25 at 9x9, sorted by size and score.
// Every level has exactly one solution and can be solved by pure logic. Run: node games/queens/generate.js
const fs = require('fs');
const path = require('path');
const { generateLevel } = require('./engine.js');
const plan = [[6, 20], [7, 25], [8, 30], [9, 25]];
const levels = [];
for (const [n, count] of plan) {
  const batch = [], seen = new Set();
  let seed = 50000 + n * 1000;
  while (batch.length < count) {
    const lv = generateLevel({ n, tier: null, seed: seed++, maxAttempts: 400 });
    if (!lv) continue;
    const key = lv.grid.join('');
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push(lv);
  }
  batch.sort((a, b) => a.score - b.score);
  levels.push(...batch);
  console.log(`n=${n}: ${batch.length} levels, score ${batch[0].score}..${batch[batch.length - 1].score}`);
}
// Relabel region numbers by first appearance (reading order), so the numbers do not give away the queen row.
const out = levels.map((lv, i) => {
  const map = new Map(); let next = 0;
  const grid = lv.grid.map((g) => { if (!map.has(g)) map.set(g, next++); return map.get(g); });
  return { id: i + 1, n: lv.n, tier: lv.tier, score: lv.score, grid, solution: lv.solution };
});
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels');
