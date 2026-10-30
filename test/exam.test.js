// Takes Matrix Test the way a player would, in a headless browser: the questions follow the mix and never repeat a
// pattern, a perfect test scores full marks, handing in with blanks asks first, the clock running out hands in,
// and a test in progress survives a reload. Needs playwright and a built index.html. Run: node test/exam.test.js
const path = require('path');
const launch = require('../scripts/browser');

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const url = 'file://' + path.join(__dirname, '..', 'index.html') + '#mtest';
  await p.goto(url);
  const fails = [];
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const press = (id) => p.click(`#ctl button[data-id="${id}"]`);
  const st = () => p.evaluate(() => {
    const g = Puzzles.debug.game.dbg;
    return { phase: g.phase, q: g.q, n: g.qs.length, finished: Puzzles.debug.finished, status: document.getElementById('status').textContent, explain: document.getElementById('explain').textContent };
  });
  await p.evaluate(() => document.getElementById('rulesClose').click());

  // The questions of both formats: the mix, easy to hard, no pattern twice.
  for (const [i, mix] of [[0, [3, 5, 9, 8]], [1, [6, 10, 18, 16]]]) {
    const r = await p.evaluate((i) => {
      Puzzles.debug.load(i);
      const qs = Puzzles.debug.game.dbg.qs;
      const sig = (l) => l.layout + ' ' + l.rules.filter((x) => x.k !== 'const').map((x) => x.c + x.a + x.k + (x.d || '')).sort().join(',');
      return { tiers: [1, 2, 3, 4].map((t) => qs.filter((l) => l.tier === t).length), sorted: qs.every((l, k) => !k || qs[k - 1].tier <= l.tier), unique: new Set(qs.map(sig)).size, n: qs.length };
    }, i);
    check(JSON.stringify(r.tiers) === JSON.stringify(mix), `format ${i}: mix ${r.tiers}`);
    check(r.sorted, `format ${i}: not easy to hard`);
    check(r.unique === r.n, `format ${i}: a pattern repeats`);
  }

  // A perfect test.
  await p.evaluate(() => Puzzles.debug.load(0));
  check((await st()).phase === 0, 'does not open on the start screen');
  await press('start');
  check((await st()).phase === 1, 'Start does not start');
  await p.evaluate(() => { const g = Puzzles.debug.game.dbg; g.qs.forEach((l, k) => g.choose(l.answer, k)); });
  await press('hand');
  let s = await st();
  check(s.finished && s.status.includes('Score 25 of 25'), 'a perfect test does not score 25: ' + s.status);
  check(s.explain.includes('Question 1') && s.explain.includes('Right'), 'no review of question 1: ' + s.explain);

  // Blanks: Hand in asks first.
  const seed1 = await p.evaluate(() => JSON.stringify(Puzzles.debug.game.dbg.qs[0]));
  await press('new');
  check(seed1 !== (await p.evaluate(() => JSON.stringify(Puzzles.debug.game.dbg.qs[0]))), 'New test gives the same questions');
  await press('start');
  await p.evaluate(() => { const g = Puzzles.debug.game.dbg; g.choose(g.qs[0].answer, 0); g.choose(g.qs[1].answer, 1); g.choose((g.qs[2].answer + 1) % 6, 2); });
  await press('hand');
  s = await st();
  check(!s.finished && s.explain.includes('22 questions have no answer'), 'Hand in with blanks does not ask: ' + s.explain);
  await press('hand');
  s = await st();
  check(s.finished && s.status.includes('Score 2 of 25'), 'two right does not score 2: ' + s.status);

  // The clock runs out.
  await press('new');
  await press('start');
  await p.evaluate(() => { Puzzles.debug.secs = 20 * 60 - 1; });
  await p.waitForTimeout(1600);
  s = await st();
  check(s.finished && s.status.includes('Score 0 of 25'), 'the clock running out does not hand in: ' + s.status);

  // A test in progress survives a reload.
  await press('new');
  await press('start');
  const before = await p.evaluate(() => { const g = Puzzles.debug.game.dbg; g.choose(3, 4); return { q0: JSON.stringify(g.qs[0]), a: g.ans.slice() }; });
  await p.reload();
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => { const g = Puzzles.debug.game.dbg; return { q0: JSON.stringify(g.qs[0]), a: g.ans.slice(), phase: g.phase }; });
  check(after.q0 === before.q0 && JSON.stringify(after.a) === JSON.stringify(before.a) && after.phase === 1, 'a reload loses the test in progress');

  const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('mtest.history') || '[]').length);
  check(hist === 3, `history has ${hist} tests, expected 3`);

  if (errs.length) fails.push('page errors: ' + errs.join(' | '));
  console.log(fails.length ? 'exam: FAILED\n  ' + fails.join('\n  ') : 'exam: all checks passed');
  await b.close();
  process.exitCode = fails.length ? 1 : 0;
})();
