// Writes a sample of Matrix Tests (both formats, many seeds) for games/matrix/verify.py to check independently: the
// tests are drawn in the browser, so there is no fixed bank to check. Run: node test/exam-sample.js out.json [count]
const fs = require('fs');
const { buildSet, TEST_MIX } = require('../games/matrix/engine.js');
const out = process.argv[2], count = +(process.argv[3] || 40);
const MIX = [TEST_MIX[25], TEST_MIX[50]];
const sets = [];
for (let k = 0; k < count; k++) {
  const seed = 1 + k * 104729;
  sets.push(buildSet(MIX[k % 2], { seed, cap: 2, shuffled: true }).levels.map((lv, i) => Object.assign({ id: i + 1 }, lv)));
}
fs.writeFileSync(out, JSON.stringify(sets));
console.log(`${count} tests, ${sets.reduce((t, s) => t + s.length, 0)} questions`);
