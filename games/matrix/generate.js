// Generates 160 levels into levels.json: 40 each of easy, medium, hard and expert, each tier sorted by the engine's
// score. Expert is aimed at the hard end of a real matrix test: rules down the columns as well as along the rows,
// places that move round the frame and figures that turn, and four or five rules at once.
// Every level has exactly one answer among its eight that every rule accepts (Engine.accepts), and no two levels
// follow the same pattern of rules (signature). The recipes and the rules for a set are in engine.js (buildSet),
// because Matrix Test draws its questions from the same recipes in the browser.
// Run: node games/matrix/generate.js
const fs = require('fs');
const path = require('path');
const { buildSet } = require('./engine.js');

const { levels, report } = buildSet({ 1: 40, 2: 40, 3: 40, 4: 40 });
console.log(report.join('\n'));
const out = levels.map((lv, i) => ({ id: i + 1, tier: lv.tier, score: lv.score, layout: lv.layout, cells: lv.cells, options: lv.options, answer: lv.answer, rules: lv.rules }));
fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(out));
console.log('wrote', out.length, 'levels,', (JSON.stringify(out).length / 1024).toFixed(0), 'kB');
