// Follows the Hint button step by step on every level of every game and checks that each level gets solved
// without a single wrong suggestion. Needs playwright and a built index.html. Run: node test/hints.test.js
const path = require('path');
const launch = require('../scripts/browser');

// step(P, g): apply the hint on screen the way a player would. Returns why it cannot be trusted, or nothing.
// done(P, g): a last check once the level is solved. Both run in the page, so they are kept as source text.
const GAMES = {
  queens: {
    step: `(P, g) => {
      const h = g.dbg.hint, n = g.dbg.n, sol = new Set(g.dbg.lv.solution.map((c, r) => r * n + c)), next = g.dbg.marks.slice();
      if (!h.cells.size) return 'no hint';
      if (h.kind === 'place') { const i = [...h.cells][0]; if (!sol.has(i)) return 'wrong queen suggested'; next[i] = 2; }
      else if (h.kind === 'elim') { for (const i of h.cells) { if (sol.has(i)) return 'crossed out a solution cell'; next[i] = 1; } if (!h.why.size) return 'no reason given'; }
      else return 'unexpected ' + h.kind;
      P.change(() => { g.dbg.marks = next; });
    }`,
  },
  tango: {
    step: `(P, g) => {
      const h = g.dbg.hint;
      if (!h.cells.size) return 'no hint';
      if (h.kind !== 'place') return 'unexpected ' + h.kind;
      const i = [...h.cells][0], next = g.dbg.marks.slice();
      if (h.value !== g.dbg.lv.solution[i]) return 'wrong symbol suggested';
      next[i] = h.value;
      P.change(() => { g.dbg.marks = next; });
    }`,
  },
  jugz: {
    // Hint follows a shortest solution, so following it from the start must take exactly the optimum.
    step: `(P, g) => { const h = g.dbg.hint; if (!h) return 'no hint'; g.dbg.pour(h.from, h.to); }`,
    done: `(P, g) => (g.dbg.moves === g.dbg.lv.opt ? null : 'took ' + g.dbg.moves + ' pours, the optimum is ' + g.dbg.lv.opt)`,
  },
};

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 400, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  let ok = true;
  for (const [id, t] of Object.entries(GAMES)) {
    const res = await p.evaluate(([id, stepSrc, doneSrc]) => {
      const P = Puzzles.debug, step = eval(stepSrc), done = doneSrc ? eval(doneSrc) : () => null;
      P.enter(id);
      const g = P.game, out = { game: id, levels: 0, solved: 0, bad: [], maxSteps: 0 };
      for (let li = 0; li < g.levels.length; li++) {
        P.load(li); out.levels++;
        let steps = 0, fail = null;
        while (!P.finished && steps < 400) {
          steps++;
          document.getElementById('hint').click();
          if (!P.hintText) { fail = 'no hint text'; break; }
          fail = step(P, g);
          if (fail) break;
        }
        if (!fail && P.finished) fail = done(P, g);
        if (P.finished && !fail) out.solved++; else out.bad.push([g.levels[li].id, fail || 'not solved']);
        out.maxSteps = Math.max(out.maxSteps, steps);
      }
      return out;
    }, [id, t.step, t.done || null]);
    console.log(JSON.stringify(res));
    if (res.solved !== res.levels) ok = false;
  }
  if (errs.length) { console.log('page errors:', errs.join(' | ')); ok = false; }
  await b.close();
  process.exitCode = ok ? 0 : 1;
})();
