// Matrix: a 3 x 3 matrix of figures with the last one missing; pick the one of six answers that completes it.
// Every row follows the same rules. Runs inside the Puzzles shell (src/shell/shell.js). Engine is
// games/matrix/engine.js: the layouts, the rules and the judge the levels were generated with. The drawing and the
// words are in draw.js, shared with Matrix Test (exam.js), which this file registers after Matrix.
const LEVELS = __LEVELS__;

// ---------- State ----------
// out[i]: 0 open, 1 tried and wrong, 2 crossed out by a hint. shown[r]: the hint has named rule r.
// pick: the answer in the gap (only ever the right one; a wrong one is crossed out instead).
// t: a wrong answer or a hint has been used in this attempt. It sticks through Undo, so a star cannot be had by
// guessing and taking the guess back.
let ctx, board, root, lv, out, shown, pick, t, bad = false;
let flash = new Set(), hintKind = '';
let clean = store.get('matrix.clean', {});

function build() {
  root.innerHTML = boardHtml(lv);
  fit();
}
function fit() { layoutBoard(root, ctx.width(), ctx.height()); }

function render() {
  const gap = root.querySelector('.mx-gap');
  gap.innerHTML = pick >= 0 ? panelSvg(lv.layout, lv.options[pick]) : '<span>?</span>';
  gap.classList.toggle('filled', pick >= 0);
  root.querySelectorAll('.mx-a').forEach((b, i) => {
    b.classList.toggle('out', out[i] === 2);
    b.classList.toggle('wrong', out[i] === 1);
    b.classList.toggle('right', pick === i);
    b.classList.toggle('flash', flash.has(i));
    b.setAttribute('aria-label', `Answer ${LETTER[i]}` + (out[i] === 1 ? ', wrong' : out[i] === 2 ? ', crossed out' : pick === i ? ', right' : ''));
  });
}

function tap(i) {
  if (ctx.finished || out[i] || pick >= 0) return;
  if (i === lv.answer) { ctx.change(() => { pick = i; bad = false; }); return; }
  ctx.change(() => { out[i] = 1; t = 1; bad = true; });
  const b = root.querySelectorAll('.mx-a')[i];
  b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
}

// Hint names the rule that crosses out the most answers still open, and crosses them out (one undo step). With one
// answer left it points at it.
function giveHint() {
  if (pick >= 0) return null;
  const open = lv.options.map((_, i) => i).filter((i) => !out[i]);
  const right = lv.options[lv.answer];
  let best = -1, cross = [];
  lv.rules.forEach((ru, ri) => {
    if (shown[ri]) return;
    const k = open.filter((i) => valueOf(lv, lv.options[i], ru) !== valueOf(lv, right, ru));
    if (k.length > cross.length) { best = ri; cross = k; }
  });
  if (best < 0) {
    flash = new Set([lv.answer]); hintKind = 'answer';
    return { label: 'Answer', text: `Only ${LETTER[lv.answer]} is left, and it fits every rule.` };
  }
  ctx.change(() => { shown[best] = 1; t = 1; bad = false; for (const i of cross) out[i] = 2; });
  flash = new Set(cross); hintKind = 'elim';
  const names = and(cross.map((i) => LETTER[i]));
  return { label: 'Rule', text: `${ruleText(lv, lv.rules[best])} ${names} ${cross.length > 1 ? 'break' : 'breaks'} it.` };
}

function init(c) {
  ctx = c; board = c.board;
  board.innerHTML = '<div class="mx"></div>';
  root = board.firstChild;
  root.addEventListener('click', (e) => { const b = e.target.closest('.mx-a'); if (b) tap(+b.dataset.i); });
}

// ---------- Rules ----------
function rulesHtml() {
  const card = Rules.card;
  // Shapes go triangle, square, circle along every row; the shade gets one step darker down the rows.
  const goal = [[0, 2, 0], [1, 2, 0], [4, 2, 0], [1, 2, 2], [4, 2, 2], [0, 2, 2], [4, 2, 4], [0, 2, 4], null].map((v) => v && [v]);
  return [
    card('01', 'The goal', 'Every row of the grid follows the same rules. Work them out and pick the answer that completes the last row. Each level has exactly one right answer.',
      strip('centre', goal, 3, 'A grid of shapes with the last one missing')),
    card('02', 'Look along the rows', 'Shape, size, shade, count and direction change in steps, come back in a new order, or stay the same. A figure can be made of several parts, each with its own rule. In the hardest levels a rule can run down the columns, or along the diagonals, which carry on from the other side of the grid; shapes move round the frame, and figures turn, shift or fold over.',
      strip('centre', [[[1, 0, 1]], [[1, 2, 1]], [[1, 4, 1]]], 3, 'A square that grows at each step')),
    card('03', 'Count', 'Sometimes it is how many there are, or which places are filled, that follows the rule.',
      strip('grid4', [[[1, 4, 1, 4]], [[3, 4, 1, 4]], [[7, 4, 1, 4]]], 3, 'One, two, then three dots')),
    card('04', 'Overlay', 'Sometimes the third figure is the first two laid on top of each other. In some levels what is in both cancels out, or the result is turned over.',
      strip('lines', [[[1 | 8]], [[1 | 16]], [[8 | 16]]], 3, 'Two figures laid on top of each other; the line they share cancels out')),
    card('05', 'One try counts', 'A wrong answer is crossed out in red. Solve a level with no wrong answer and no hint for a star.',
      `<svg class="mini" viewBox="0 0 128 96" role="img" aria-label="A star"><rect width="128" height="96" rx="4" style="fill:var(--mx-gap)"/><path transform="translate(64 48) scale(2.2)" d="M0-12l3.5 7.6 8.2.9-6.1 5.6 1.7 8.1L0 6.1l-7.3 4.1 1.7-8.1-6.1-5.6 8.2-.9z" style="fill:var(--accent)"/></svg>`),
    card('06', 'Stuck? Tap Hint', 'Hint names one rule and crosses out the answers that break it.',
      strip('centre', [[[0, 2, 2]], [[4, 2, 2]], [[0, 2, 4]], [[1, 2, 2]]], 4, 'Four answers, two crossed out', [0, 2])),
  ].join('');
}

Puzzles.register({
  id: 'matrix', name: 'Matrix', tagline: 'Find the figure that completes the grid, the way an IQ test does.', accent: '#a895ff',
  logo: __LOGO__,
  levels: LEVELS,
  subtitle: (l) => TIER_NAME[l.tier],
  legend: '<span class="t1"><i></i>Easy</span><span class="t2"><i></i>Medium</span><span class="t3"><i></i>Hard</span><span class="t4"><i></i>Expert</span>',
  levelClass: (l) => 't' + l.tier,
  sections: () => [1, 2, 3, 4].map((k) => ({ title: TIER_NAME[k], items: LEVELS.filter((l) => l.tier === k) })),
  badge: (l) => (clean[l.id] ? '★' : ''),
  init,
  load(l) {
    lv = l; out = new Array(l.options.length).fill(0); shown = new Array(l.rules.length).fill(0); pick = -1; t = 0; bad = false;
    flash = new Set(); hintKind = '';
    build();
  },
  render,
  resize: fit,
  snapshot: () => ({ out: out.slice(), shown: shown.slice(), pick, t }),
  restore(s) { out = s.out.slice(); shown = s.shown.slice(); pick = s.pick; t = Math.max(t, s.t); bad = false; },
  // Restart keeps the mark of a wrong answer or hint; restarting a solved level is a new attempt.
  reset() { if (ctx.finished) t = 0; out = new Array(lv.options.length).fill(0); shown = new Array(lv.rules.length).fill(0); pick = -1; bad = false; },
  started: () => pick >= 0 || t > 0 || out.some(Boolean),
  // Working out the rule is the whole puzzle and the answer one tap, so the time counts from when the level shows.
  clockOnLoad: true,
  // The grid and the answers use the whole height of an upright phone, not only a square.
  fill: true,
  solved: () => pick === lv.answer,
  onSolved() {
    if (t) return;
    clean[lv.id] = 1;
    store.set('matrix.clean', clean);
  },
  winNote() {
    if (!t) return '★  No wrong answer, no hint.';
    const w = out.filter((x) => x === 1).length, h = shown.filter(Boolean).length;
    const said = [w && `${w} wrong ${w > 1 ? 'answers' : 'answer'}`, h && `${h} ${h > 1 ? 'hints' : 'hint'}`].filter(Boolean);
    return (said.length ? cap(and(said)) + '. ' : '') + 'No wrong answer and no hint for a star.';
  },
  status() {
    const w = out.filter((x) => x === 1).length, h = shown.filter(Boolean).length;
    return { count: `Wrong <b>${w}</b> · Hints <b>${h}</b>`, msg: bad ? 'Not that one.' : 'Pick the missing figure.', bad };
  },
  hint: giveHint,
  clearHint() { flash = new Set(); hintKind = ''; },
  rulesHtml,
  // For the tests in test/.
  dbg: {
    get lv() { return lv; },
    get hint() { return { kind: hintKind, cells: flash }; },
    get wrong() { return out.filter((x) => x === 1).length; },
    tap,
  },
});

registerExam();
