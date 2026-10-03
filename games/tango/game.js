// Tango: fill the board with suns and moons. As many of each in every row and column, never three alike in a row,
// = between two cells means the same symbol, × means different. Runs inside the Puzzles shell (src/shell/shell.js).
// Engine is games/tango/engine.js: its solver drives Hint.
const LEVELS = __LEVELS__;
const MOON_D = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
const ICON = [
  '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
  `<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="${MOON_D}"/></svg>`,
];
const TIER_NAME = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

let ctx, board, cells, lv, n, marks, cons, solver; // marks: -1 empty, 0 sun, 1 moon; prefilled cells (lv.given) cannot change
let hint = { cells: new Set(), why: new Set(), kind: '', value: -1 };
const clearHint = () => { hint = { cells: new Set(), why: new Set(), kind: '', value: -1 }; };
const isGiven = (i) => lv.given[i] !== -1;

// Cells that break a rule: three alike in a row, too many of one kind in a row/column, or a sign that does not hold.
function conflicts() {
  const bad = new Set(), half = n / 2;
  for (let k = 0; k < n; k++) for (const kind of ['r', 'c']) {
    const line = Engine.lineCells(n, kind, k), cnt = [[], []];
    line.forEach((i, p) => {
      const x = marks[i];
      if (x === -1) return;
      cnt[x].push(i);
      if (p >= 2 && marks[line[p - 1]] === x && marks[line[p - 2]] === x) { bad.add(i); bad.add(line[p - 1]); bad.add(line[p - 2]); }
    });
    for (const x of [0, 1]) if (cnt[x].length > half) cnt[x].forEach((i) => bad.add(i));
  }
  for (const c of cons) {
    const a = marks[c.a], b = marks[c.b];
    if (a !== -1 && b !== -1 && ((c.t === 1 && a !== b) || (c.t === 2 && a === b))) { bad.add(c.a); bad.add(c.b); }
  }
  return bad;
}

// The signs (= and ×) are drawn on the canvas too, centred on the border between two cells.
function fit() {
  Grid.fit(board, n, ctx.width(), (c, { dpr, thinD, frameD, cellD, at, col }) => {
    const ink = col('--ink', '#0b0d0d');
    for (let i = 0; i < n * n; i++) {
      c.fillStyle = isGiven(i) ? col('--given', '#3d443f') : col('--cell', '#262b2b');
      c.fillRect(at(i % n), at((i / n) | 0), cellD, cellD);
    }
    c.fillStyle = ink;
    for (let k = 1; k < n; k++) c.fillRect(at(k) - (thinD >> 1), frameD, thinD, n * cellD);
    for (let r = 1; r < n; r++) c.fillRect(frameD, at(r) - (thinD >> 1), n * cellD, thinD);
    // No circle behind a sign: a dark edge under a light stroke, so it shows over the grid lines and on lighter cells.
    const d = Math.max(Math.round(3.5 * dpr), Math.round(cellD * 0.105)), lw = Math.max(2, Math.round(d * 0.42));
    const glyph = (cx, cy, t) => {
      c.lineCap = 'round';
      c.beginPath();
      if (t === 1) { c.moveTo(cx - d, cy - d * 0.5); c.lineTo(cx + d, cy - d * 0.5); c.moveTo(cx - d, cy + d * 0.5); c.lineTo(cx + d, cy + d * 0.5); }
      else { c.moveTo(cx - d * 0.8, cy - d * 0.8); c.lineTo(cx + d * 0.8, cy + d * 0.8); c.moveTo(cx + d * 0.8, cy - d * 0.8); c.lineTo(cx - d * 0.8, cy + d * 0.8); }
      c.strokeStyle = ink; c.lineWidth = lw + Math.max(2, Math.round(1.6 * dpr)); c.stroke();
      c.strokeStyle = col('--fg', '#e9ebe6'); c.lineWidth = lw; c.stroke();
    };
    for (let r = 0; r < n; r++) for (let k = 0; k < n - 1; k++) { const t = lv.h[r * (n - 1) + k]; if (t) glyph(at(k + 1), at(r) + cellD / 2, t); }
    for (let r = 0; r < n - 1; r++) for (let k = 0; k < n; k++) { const t = lv.v[r * n + k]; if (t) glyph(at(k) + cellD / 2, at(r + 1), t); }
  });
}

// A clash only shows once the board has been still for a second: on the way from sun to moon (or back) a cell often
// breaks a rule for a moment. Every change to the board restarts the wait.
let conflictsVisible = false, conflictTimer = null, lastSig = '';
function visibleConflicts() {
  const real = conflicts(), sig = marks.join(',');
  if (sig !== lastSig) { lastSig = sig; conflictsVisible = false; clearTimeout(conflictTimer); conflictTimer = null; }
  if (!real.size) { conflictsVisible = false; clearTimeout(conflictTimer); conflictTimer = null; }
  else if (!conflictsVisible && !conflictTimer) {
    conflictTimer = setTimeout(() => { conflictTimer = null; if (marks.join(',') === lastSig) { conflictsVisible = true; ctx.refresh(); } }, 1000);
  }
  return conflictsVisible ? real : new Set();
}

let shownBad = new Set();
function paint() {
  shownBad = visibleConflicts();
  for (let i = 0; i < cells.children.length; i++) {
    const el = cells.children[i], m = marks[i];
    el.innerHTML = m === -1 ? '' : ICON[m];
    el.classList.toggle('conflict', shownBad.has(i));
    el.classList.toggle('hint', hint.cells.has(i));
    el.classList.toggle('why', hint.why.has(i));
    el.setAttribute('aria-label', `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}, ${m === -1 ? 'empty' : Engine.SYM[m]}${isGiven(i) ? ', locked' : ''}`);
  }
}

function build() {
  cells = Grid.build(board, n);
  for (let i = 0; i < n * n; i++) if (isGiven(i)) { cells.children[i].classList.add('locked'); cells.children[i].setAttribute('aria-disabled', 'true'); }
  fit();
}

const nextVal = (m) => (m === -1 ? 0 : m === 0 ? 1 : -1);
function init(c) {
  ctx = c; board = c.board;
  board.addEventListener('click', (e) => {
    const el = e.target.closest('.cell'); if (!el || ctx.finished) return;
    const i = +el.dataset.i; if (isGiven(i)) return;
    ctx.change(() => { marks[i] = nextVal(marks[i]); });
  });
}

function giveHint() {
  const wrong = marks.findIndex((m, i) => m !== -1 && !isGiven(i) && m !== lv.solution[i]);
  if (wrong >= 0) { hint = { cells: new Set([wrong]), why: new Set(), kind: 'wrong', value: -1 }; return { text: 'The marked cell is wrong. Change it or clear it.' }; }
  const s = solver.findStep(marks, 3) || solver.findStep(marks, 3, 40);
  if (s) { hint = { cells: new Set(s.cells), why: new Set(s.why), kind: 'place', value: s.value }; return { text: s.text }; }
  const i = marks.indexOf(-1);
  if (i < 0) return null;
  const one = Engine.ONE[lv.solution[i]];
  hint = { cells: new Set([i]), why: new Set(), kind: 'place', value: lv.solution[i] };
  return { text: `${one.charAt(0).toUpperCase() + one.slice(1)} belongs here. The level can be solved from this cell.` };
}

// ---------- Rules ----------
// o: { rows, cols, vals: symbols (-1 empty), given: locked cells, edges: [{ r, c, dir: 'h' | 'v', t }], bad, why, hint }
function mini(o) {
  const vals = o.vals || new Array(o.rows * o.cols).fill(-1), has = (a, i) => (a || []).includes(i);
  return Grid.mini(o, {
    fill: (i) => (has(o.given, i) ? 'var(--given)' : 'var(--cell)'),
    lines(at, s) {
      let ln = '';
      for (let c = 1; c < o.cols; c++) ln += `M${at(c) - 0.375} ${at(0)}h0.75v${o.rows * s}h-0.75z`;
      for (let r = 1; r < o.rows; r++) ln += `M${at(0)} ${at(r) - 0.375}h${o.cols * s}v0.75h${-o.cols * s}z`;
      return ln;
    },
    mark(i, x, y, s) {
      if (vals[i] === 0) return `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.3}" style="fill:var(--sun);stroke:var(--sun-edge)" stroke-width="1"/>`;
      if (vals[i] === 1) return `<path d="${MOON_D}" transform="translate(${x + s * 0.18} ${y + s * 0.18}) scale(${(s * 0.64) / 24})" style="fill:var(--moon);stroke:var(--moon-edge)" stroke-width="1.5" stroke-linejoin="round"/>`;
      return '';
    },
    after(at, s) {
      let h = '';
      for (const e of o.edges || []) {
        const cx = e.dir === 'h' ? at(e.c + 1) : at(e.c) + s / 2, cy = e.dir === 'h' ? at(e.r) + s / 2 : at(e.r + 1);
        const g = e.t === 1 ? `M${cx - 2.4} ${cy - 1.2}h4.8M${cx - 2.4} ${cy + 1.2}h4.8` : `M${cx - 2} ${cy - 2}l4 4m0-4l-4 4`;
        h += `<path d="${g}" style="stroke:var(--ink)" stroke-width="3.2" stroke-linecap="round"/><path d="${g}" style="stroke:var(--fg)" stroke-width="1.4" stroke-linecap="round"/>`;
      }
      return h;
    },
  });
}

function rulesHtml() {
  const row = (vals, extra) => mini(Object.assign({ rows: 1, cols: vals.length, vals }, extra));
  const one = (m) => mini({ rows: 1, cols: 1, vals: [m] });
  const card = Rules.card;
  // A solved 4 x 4 board: sun = 0, moon = 1.
  const solved = [0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0];
  return [
    card('01', 'The goal', 'Fill the whole board with suns and moons, one symbol per cell. Cells filled from the start are locked. Every level has exactly one solution and can be solved by logic; you never need to guess.',
      mini({ rows: 4, cols: 4, vals: solved, given: [0, 6, 9, 14], label: 'A solved board' }), Rules.RIGHT),
    card('02', 'At most two in a row', 'No more than two identical symbols may sit next to each other, across or down.',
      row([0, 0, 0, 1, 1], { bad: [0, 1, 2], label: 'Three suns in a row' }), Rules.WRONG),
    card('03', 'As many of each', 'Every row and column has as many suns as moons. On a board with six rows that is three of each.',
      row([0, 1, 1, 0, 1, 0], { label: 'Three suns and three moons' }), Rules.RIGHT),
    card('04', 'Equals sign', 'Two cells with an <b>=</b> between them have the same symbol.',
      row([1, 1], { edges: [{ r: 0, c: 0, dir: 'h', t: 1 }], label: 'Two moons with an equals sign' }), Rules.RIGHT),
    card('05', 'Cross', 'Two cells with a <b>×</b> between them have different symbols.',
      row([0, 1], { edges: [{ r: 0, c: 0, dir: 'h', t: 2 }], label: 'A sun and a moon with a cross' }), Rules.RIGHT),
    `<section class="rule col"><div><h3><span class="n">06</span>How to fill in</h3><p>Tap a cell to cycle through sun, moon and empty.</p></div>
      <div class="taps"><div>${one(0)}1 tap<br>sun</div><div>${one(1)}2 taps<br>moon</div><div>${one(-1)}3 taps<br>empty</div></div></section>`,
    card('07', 'Stuck? Tap Hint', 'Hint shows the next logical step. The stripes show why, the white frame shows the cell to change.',
      mini({ rows: 4, cols: 4, vals: [0, 0, -1, -1, -1, -1, 0, 0, 0, -1, 0, -1, -1, 0, -1, 0], given: [0, 6, 9, 14], why: [0, 1], hint: [2], label: 'Hint: the row already has two suns, the rest are moons' })),
  ].join('');
}

Puzzles.register({
  id: 'tango', name: 'Tango', tagline: 'Suns and moons: as many of each, never three in a row.', accent: '#f0a93a',
  logo: __LOGO__,
  levels: LEVELS,
  subtitle: (l) => `${l.n} × ${l.n} · ${TIER_NAME[l.tier]}`,
  legend: '<span class="t1"><i></i>Easy</span><span class="t2"><i></i>Medium</span><span class="t3"><i></i>Hard</span>',
  levelClass: (l) => 't' + l.tier,
  sections: () => [6, 8].map((s) => ({ title: `${s} × ${s}`, items: LEVELS.filter((l) => l.n === s) })).filter((s) => s.items.length),
  init,
  load(l) {
    lv = l; n = l.n; marks = l.given.slice(); clearHint();
    cons = Engine.buildCons(n, l.h, l.v);
    solver = Engine.makeSolver(n, l.h, l.v);
    build();
  },
  render: paint,
  resize: fit,
  snapshot: () => marks.slice(),
  restore(s) { marks = s.slice(); },
  reset() { marks = lv.given.slice(); },
  started: () => marks.some((m, i) => m !== lv.given[i]),
  solved: () => !marks.includes(-1) && conflicts().size === 0,
  status() {
    const filled = marks.filter((m) => m !== -1).length, bad = shownBad.size > 0;
    return { count: `Cells <b>${filled}</b> of ${n * n}`, msg: bad ? 'Something breaks the rules.' : 'Tap: sun, moon, empty.', bad };
  },
  hint: giveHint,
  clearHint,
  rulesHtml,
  // For the tests in test/.
  dbg: { get marks() { return marks; }, set marks(v) { marks = v; }, get hint() { return hint; }, get lv() { return lv; }, get n() { return n; } },
});
