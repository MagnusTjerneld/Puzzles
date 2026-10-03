// Follows the Hint button step by step on every level of every grid game and checks that each level gets solved
// without a single wrong suggestion. Needs playwright and a built index.html. Run: node test/hints.test.js
const path = require('path');
const launch = require('../scripts/browser');

// Applies one hint the way a player would, or returns why it cannot be trusted.
const CHECKS = {
  queens: `(g, h) => {
    const n = g.dbg.n, sol = new Set(g.dbg.lv.solution.map((c, r) => r * n + c)), next = g.dbg.marks.slice();
    if (h.kind === 'place') { const i = [...h.cells][0]; if (!sol.has(i)) return 'wrong queen suggested'; next[i] = 2; }
    else if (h.kind === 'elim') { for (const i of h.cells) { if (sol.has(i)) return 'crossed out a solution cell'; next[i] = 1; } if (!h.why.size) return 'no reason given'; }
    else return 'unexpected ' + h.kind;
    return next;
  }`,
  tango: `(g, h) => {
    if (h.kind !== 'place') return 'unexpected ' + h.kind;
    const i = [...h.cells][0], next = g.dbg.marks.slice();
    if (h.value !== g.dbg.lv.solution[i]) return 'wrong symbol suggested';
    next[i] = h.value;
    return next;
  }`,
};

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  let ok = true;
  for (const [id, check] of Object.entries(CHECKS)) {
    const res = await p.evaluate(([id, check]) => {
      const P = Puzzles.debug, apply = eval(check);
      P.enter(id);
      const g = P.game, out = { game: id, levels: 0, solved: 0, bad: [], maxSteps: 0, kinds: {} };
      for (let li = 0; li < g.levels.length; li++) {
        P.load(li); out.levels++;
        let steps = 0, fail = null;
        while (!P.finished && steps < 400) {
          steps++;
          document.getElementById('hint').click();
          const h = g.dbg.hint;
          out.kinds[h.kind] = (out.kinds[h.kind] || 0) + 1;
          if (!h.cells.size) { fail = 'no hint'; break; }
          if (!P.hintText) { fail = 'no text'; break; }
          const next = apply(g, h);
          if (typeof next === 'string') { fail = next; break; }
          P.change(() => { g.dbg.marks = next; });
        }
        if (P.finished) out.solved++; else out.bad.push([g.levels[li].id, fail || 'not solved']);
        out.maxSteps = Math.max(out.maxSteps, steps);
      }
      return out;
    }, [id, check]);
    console.log(JSON.stringify(res));
    if (res.solved !== res.levels) ok = false;
  }
  if (errs.length) { console.log('page errors:', errs.join(' | ')); ok = false; }
  await b.close();
  process.exitCode = ok ? 0 : 1;
})();
