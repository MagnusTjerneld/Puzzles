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
let ctx, board, root, lv, out, shown, pick, t, h = 0, bad = false;
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

// Hint gives the puzzle away a step at a time, and never the answer. The first says where to look (which part, which
// way) and crosses out two answers that break that rule; the second says the rule in full and crosses out two more.
// Then two answers are left, and the choice is the player's. A hint never leaves fewer than two answers standing.
// shown[r]: 1 when rule r has been pointed at, 2 when it has been said in full. h: hints given (one undo step each).
const HINTS = 2;
function giveHint() {
  if (pick >= 0) return null;
  const right = lv.options[lv.answer];
  const open = lv.options.map((_, i) => i).filter((i) => !out[i] && i !== lv.answer);
  const room = Math.min(2, open.length - 1);
  if (!open.length) return { label: 'Hint', text: 'Only one answer is left.' };
  if (h >= HINTS || room < 1) { hintKind = 'none'; return { label: 'Hint', text: `No more hints: ${open.length + 1} answers are left, and one of them is right.` }; }
  const breaks = (ri) => open.filter((i) => valueOf(lv, lv.options[i], lv.rules[ri]) !== valueOf(lv, right, lv.rules[ri]));
  // The second hint says the rule the first pointed at, while it still crosses something out; otherwise the rule
  // that crosses out the most.
  let ri = shown.indexOf(1);
  if (ri < 0 || !breaks(ri).length) {
    ri = -1;
    lv.rules.forEach((_, k) => { if (shown[k] !== 2 && (ri < 0 || breaks(k).length > breaks(ri).length)) ri = k; });
  }
  const full = h === 1 || shown[ri] === 1;
  let cross = breaks(ri).slice(0, room);
  // A rule that crosses out only one: the other comes from the rest (every wrong answer breaks some rule).
  const extra = open.filter((i) => !cross.includes(i)).slice(0, room - cross.length);
  ctx.change(() => { shown[ri] = full ? 2 : 1; h++; t = 1; bad = false; for (const i of cross.concat(extra)) out[i] = 2; });
  flash = new Set(cross.concat(extra)); hintKind = 'elim';
  const names = and(cross.map((i) => LETTER[i])), more = extra.length ? ` ${and(extra.map((i) => LETTER[i]))} ${extra.length > 1 ? 'do' : 'does'} not fit either.` : '';
  return full
    ? { label: 'Rule', text: `${ruleText(lv, lv.rules[ri])} ${names} ${cross.length > 1 ? 'break' : 'breaks'} it.${more}` }
    : { label: 'Where to look', text: `${lookText(lv, lv.rules[ri])} ${names} ${cross.length > 1 ? 'do' : 'does'} not fit.${more}` };
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
    card('06', 'Stuck? Tap Hint', 'The first hint says where to look and crosses out two answers; the second says the rule and crosses out two more. The last choice is yours.',
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
    lv = l; out = new Array(l.options.length).fill(0); shown = new Array(l.rules.length).fill(0); pick = -1; t = 0; h = 0; bad = false;
    flash = new Set(); hintKind = '';
    build();
  },
  render,
  resize: fit,
  snapshot: () => ({ out: out.slice(), shown: shown.slice(), pick, t, h }),
  restore(s) { out = s.out.slice(); shown = s.shown.slice(); pick = s.pick; h = s.h; t = Math.max(t, s.t); bad = false; },
  // Restart keeps the mark of a wrong answer or hint; restarting a solved level is a new attempt.
  reset() { if (ctx.finished) t = 0; out = new Array(lv.options.length).fill(0); shown = new Array(lv.rules.length).fill(0); pick = -1; h = 0; bad = false; },
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
    const w = out.filter((x) => x === 1).length;
    const said = [w && `${w} wrong ${w > 1 ? 'answers' : 'answer'}`, h && `${h} ${h > 1 ? 'hints' : 'hint'}`].filter(Boolean);
    return (said.length ? cap(and(said)) + '. ' : '') + 'No wrong answer and no hint for a star.';
  },
  status() {
    const w = out.filter((x) => x === 1).length;
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
    get open() { return lv.options.map((_, i) => i).filter((i) => !out[i]); },
    get hints() { return h; },
    tap,
  },
});

registerExam();
