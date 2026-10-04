// Queens: one queen in every row, column and colour region, and no two queens touching, not even diagonally.
// Runs inside the Puzzles shell (src/shell/shell.js); Engine is games/queens/engine.js (only the generator needs it).
const LEVELS = __LEVELS__;
const CROWN_D = 'M3 8l4.5 4 4.5-7 4.5 7L21 8l-2 10H5L3 8zm2 12h14v2H5z';
const CROWN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${CROWN_D}"/></svg>`;
const NAMES = ['brick red', 'ochre', 'olive', 'green', 'teal', 'blue', 'purple', 'plum', 'raspberry'];

let ctx, board, cells, lv, n, marks; // marks: 0 empty, 1 cross, 2 queen
let hint = { cells: new Set(), why: new Set(), kind: '' };
const clearHint = () => { hint = { cells: new Set(), why: new Set(), kind: '' }; };

function conflicts() {
  const bad = new Set(); const q = [];
  marks.forEach((m, i) => { if (m === 2) q.push(i); });
  for (let a = 0; a < q.length; a++) for (let b = a + 1; b < q.length; b++) {
    const i = q[a], j = q[b], ri = (i / n) | 0, rj = (j / n) | 0, ci = i % n, cj = j % n;
    if (ri === rj || ci === cj || lv.grid[i] === lv.grid[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) { bad.add(i); bad.add(j); }
  }
  return bad;
}

// Regions are told apart by thick lines where two regions meet and thin ones inside a region.
function fit() {
  Grid.fit(board, n, ctx.width(), (c, { dpr, thinD, cellD, at, col }) => {
    const thickD = Math.max(3, Math.round(3.5 * dpr));
    for (let i = 0; i < n * n; i++) { c.fillStyle = col('--r' + lv.grid[i]); c.fillRect(at(i % n), at((i / n) | 0), cellD, cellD); }
    const g = lv.grid, wOf = (a, b) => (g[a] !== g[b] ? thickD : thinD);
    c.fillStyle = col('--ink', '#0b0d0d');
    for (let r = 0; r < n; r++) for (let k = 1; k < n; k++) {          // vertical lines
      const w = wOf(r * n + k - 1, r * n + k);
      c.fillRect(at(k) - (w >> 1), at(r), w, cellD);
    }
    for (let r = 1; r < n; r++) for (let k = 0; k < n; k++) {          // horizontal lines
      const w = wOf((r - 1) * n + k, r * n + k);
      c.fillRect(at(k), at(r) - (w >> 1), cellD, w);
    }
    for (let r = 1; r < n; r++) for (let k = 1; k < n; k++) {          // corners where lines meet
      const m = Math.max(
        wOf((r - 1) * n + k - 1, r * n + k - 1), wOf((r - 1) * n + k, r * n + k),
        wOf((r - 1) * n + k - 1, (r - 1) * n + k), wOf(r * n + k - 1, r * n + k));
      c.fillRect(at(k) - (m >> 1), at(r) - (m >> 1), m, m);
    }
  });
}

function paint() {
  const bad = conflicts();
  for (let i = 0; i < cells.children.length; i++) {
    const el = cells.children[i], m = marks[i];
    el.innerHTML = m === 2 ? CROWN : (m === 1 ? '&times;' : '');
    el.classList.toggle('conflict', bad.has(i));
    el.classList.toggle('hint', hint.cells.has(i));
    el.classList.toggle('why', hint.why.has(i));
    el.setAttribute('aria-label', `Row ${((i / n) | 0) + 1}, column ${(i % n) + 1}, ${['empty', 'cross', 'queen'][m]}`);
  }
}

// Drag along a row or a column to cross every cell the finger passes. Queens are left alone.
// The drag locks to the row or the column by the way the finger is heading when it leaves the first cell, and the
// finger is then read as if it stayed on that line, so a wobble never catches a cell in the next row. Only when the
// finger strays a whole cell off the line does the drag turn: from the cell it had reached, along the crossing line.
// That way a drag can still go round a corner, say to draw a frame round a queen.
// A drag that starts on a cross erases crosses instead. The whole drag is one undo step.
// If the finger never leaves the cell it started on, it counts as an ordinary tap (click below).
let drag = null, skipClick = false;
function dragMark(i) {
  if (i < 0) return;
  if (drag.erase ? marks[i] === 1 : marks[i] === 0) { marks[i] = drag.erase ? 0 : 1; drag.changed = true; }
}
// Lock the drag to the row (or column) through cell i, starting from the cell's centre.
function lockTo(i, row) {
  const r = cells.children[i].getBoundingClientRect();
  drag.row = row; drag.x = r.left + r.width / 2; drag.y = r.top + r.height / 2; drag.line = row ? drag.y : drag.x;
}
function init(c) {
  ctx = c; board = c.board;
  // iOS Safari does not always honour overscroll-behavior. Touch moves that start on the board may therefore never
  // scroll or reload the page. Only touchmove is stopped, so ordinary taps (click) still work.
  board.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  board.addEventListener('pointerdown', (e) => {
    if (ctx.finished || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const i = Grid.cellAt(board, n, e.clientX, e.clientY); if (i < 0) return;
    drag = { id: e.pointerId, start: i, x0: e.clientX, y0: e.clientY, x: 0, y: 0, row: true, line: 0, active: false, erase: marks[i] === 1, base: marks.slice(), changed: false };
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const to = Grid.cellAt(board, n, e.clientX, e.clientY);
    if (!drag.active) {
      if (to === drag.start || to < 0) return;
      drag.active = true; clearHint();
      board.setPointerCapture(e.pointerId);
      lockTo(drag.start, Math.abs(e.clientX - drag.x0) >= Math.abs(e.clientY - drag.y0));
      dragMark(drag.start);
    }
    const cellPx = cells.children[0].getBoundingClientRect().width;
    if (Math.abs(drag.row ? e.clientY - drag.line : e.clientX - drag.line) > cellPx) {
      const at = Grid.cellAt(board, n, drag.x, drag.y);
      if (at >= 0) lockTo(at, !drag.row);
    }
    // Follow the finger along the line in small steps, so a quick swipe does not skip cells.
    const x = drag.row ? e.clientX : drag.line, y = drag.row ? drag.line : e.clientY;
    const dx = x - drag.x, dy = y - drag.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cellPx / 4)));
    for (let k = 1; k <= steps; k++) dragMark(Grid.cellAt(board, n, drag.x + (dx * k) / steps, drag.y + (dy * k) / steps));
    drag.x = x; drag.y = y;
    ctx.refresh();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.active) {
      skipClick = true; setTimeout(() => { skipClick = false; }, 0);
      if (drag.changed) ctx.record(drag.base);
    }
    drag = null;
  };
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);
  board.addEventListener('click', (e) => {
    if (skipClick) { skipClick = false; return; }
    const el = e.target.closest('.cell'); if (!el || ctx.finished) return;
    const i = +el.dataset.i;
    ctx.change(() => { marks[i] = (marks[i] + 1) % 3; });
  });
}

// ---------- Hint ----------
const listText = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const regPhrase = (gs) => (gs.length === 1 ? `The ${NAMES[gs[0]]} region` : `The ${listText(gs.map((g) => NAMES[g]))} regions`);
const combos = (arr, k) => { const out = []; (function rec(st, cur) { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = st; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); } })(0, []); return out; };
const pc = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

// Finds the next logical step from the queens on the board: either a queen that must go in a certain cell,
// or cells that can be crossed out. Also returns which cells are the reason (why).
function computeHint() {
  const grid = lv.grid, N = n * n, R = (i) => (i / n) | 0, C = (i) => i % n;
  const st = { cand: new Uint8Array(N).fill(1), rowP: new Uint8Array(n), colP: new Uint8Array(n), regP: new Uint8Array(n) };
  const place = (S, i) => {
    const r = R(i), c = C(i), g = grid[i];
    for (let j = 0; j < N; j++) if (R(j) === r || C(j) === c || grid[j] === g || (Math.abs(R(j) - r) <= 1 && Math.abs(C(j) - c) <= 1)) S.cand[j] = 0;
    S.rowP[r] = 1; S.colP[c] = 1; S.regP[g] = 1;
  };
  marks.forEach((m, i) => { if (m === 2) place(st, i); });
  const regCells = (g) => { const o = []; for (let i = 0; i < N; i++) if (grid[i] === g) o.push(i); return o; };
  const rowCells = (r) => Array.from({ length: n }, (_, c) => r * n + c);
  const colCells = (c) => Array.from({ length: n }, (_, r) => r * n + c);
  const lineName = (kind, ids) => (kind === 'r' ? (ids.length === 1 ? `Row ${ids[0] + 1}` : `Rows ${listText(ids.map((x) => x + 1))}`) : (ids.length === 1 ? `Column ${ids[0] + 1}` : `Columns ${listText(ids.map((x) => x + 1))}`));
  const lineLower = (kind, ids) => lineName(kind, ids).replace(/^R/, 'r').replace(/^C/, 'c');
  const dead = (S) => {
    const gc = new Array(n).fill(0), rc = new Array(n).fill(0), cc = new Array(n).fill(0);
    for (let i = 0; i < N; i++) if (S.cand[i]) { gc[grid[i]]++; rc[R(i)]++; cc[C(i)]++; }
    for (let x = 0; x < n; x++) {
      if (!S.regP[x] && gc[x] === 0) return { cells: regCells(x), text: `the ${NAMES[x]} region` };
      if (!S.rowP[x] && rc[x] === 0) return { cells: rowCells(x), text: `row ${x + 1}` };
      if (!S.colP[x] && cc[x] === 0) return { cells: colCells(x), text: `column ${x + 1}` };
    }
    return null;
  };
  function setStep(k) {
    const regs = [], rows = [], cols = [];
    for (let x = 0; x < n; x++) { if (!st.regP[x]) regs.push(x); if (!st.rowP[x]) rows.push(x); if (!st.colP[x]) cols.push(x); }
    if (regs.length <= k) return null;
    const rm = new Array(n).fill(0), cm = new Array(n).fill(0), rr = new Array(n).fill(0), cc = new Array(n).fill(0);
    for (let i = 0; i < N; i++) if (st.cand[i]) { const g = grid[i]; rm[g] |= 1 << R(i); cm[g] |= 1 << C(i); rr[R(i)] |= 1 << g; cc[C(i)] |= 1 << g; }
    const bits = (m) => { const o = []; for (let x = 0; x < n; x++) if ((m >> x) & 1) o.push(x); return o; };
    const take = (f) => { const e = []; for (let i = 0; i < N; i++) if (st.cand[i] && f(i)) e.push(i); return e; };
    for (const S of combos(regs, k)) {
      let rU = 0, cU = 0, sm = 0; for (const g of S) { rU |= rm[g]; cU |= cm[g]; sm |= 1 << g; }
      const inS = (i) => (sm >> grid[i]) & 1;
      if (pc(rU) === k) { const e = take((i) => ((rU >> R(i)) & 1) && !inS(i)); if (e.length) { const ids = bits(rU); return { elim: e, why: S.flatMap(regCells), text: k === 1 ? `${regPhrase(S)} lies only in ${lineLower('r', ids)}. Its queen must go there, so the rest of the row is out.` : `${regPhrase(S)} fit only in ${lineLower('r', ids)}. Their queens fill those rows, so other regions are out there.` }; } }
      if (pc(cU) === k) { const e = take((i) => ((cU >> C(i)) & 1) && !inS(i)); if (e.length) { const ids = bits(cU); return { elim: e, why: S.flatMap(regCells), text: k === 1 ? `${regPhrase(S)} lies only in ${lineLower('c', ids)}. Its queen must go there, so the rest of the column is out.` : `${regPhrase(S)} fit only in ${lineLower('c', ids)}. Their queens fill those columns, so other regions are out there.` }; } }
    }
    for (const kind of ['r', 'c']) {
      const lines = kind === 'r' ? rows : cols, map = kind === 'r' ? rr : cc;
      for (const L of combos(lines, k)) {
        let gU = 0, lm = 0; for (const x of L) { gU |= map[x]; lm |= 1 << x; }
        if (pc(gU) !== k) continue;
        const e = take((i) => ((gU >> grid[i]) & 1) && !((lm >> (kind === 'r' ? R(i) : C(i))) & 1));
        if (!e.length) continue;
        const gs = bits(gU);
        return { elim: e, why: L.flatMap(kind === 'r' ? rowCells : colCells), text: `${lineName(kind, L)} can only have ${k === 1 ? 'its queen' : 'their queens'} in ${regPhrase(gs).toLowerCase()}, so the other cells of ${k === 1 ? 'that region' : 'those regions'} are out.` };
      }
    }
    return null;
  }

  for (let guard = 0; guard < 300; guard++) {
    for (let g = 0; g < n; g++) {
      if (st.regP[g]) continue;
      const c = regCells(g).filter((i) => st.cand[i]);
      if (c.length === 1) return { kind: 'place', cells: [c[0]], why: regCells(g), text: `The ${NAMES[g]} region has only one cell left. Place a queen in the marked cell.` };
    }
    for (let r = 0; r < n; r++) {
      if (st.rowP[r]) continue;
      const c = rowCells(r).filter((i) => st.cand[i]);
      if (c.length === 1) return { kind: 'place', cells: [c[0]], why: rowCells(r), text: `Row ${r + 1} has only one cell left. Place a queen in the marked cell.` };
    }
    for (let q = 0; q < n; q++) {
      if (st.colP[q]) continue;
      const c = colCells(q).filter((i) => st.cand[i]);
      if (c.length === 1) return { kind: 'place', cells: [c[0]], why: colCells(q), text: `Column ${q + 1} has only one cell left. Place a queen in the marked cell.` };
    }
    let progressed = false;
    for (const k of [1, 2, 3]) {
      const stp = setStep(k);
      if (!stp) continue;
      stp.elim.forEach((i) => { st.cand[i] = 0; });
      if (stp.elim.some((i) => marks[i] !== 1)) return { kind: 'elim', cells: stp.elim, why: stp.why, text: stp.text + ' Cross out the marked cells.' };
      progressed = true; break;
    }
    if (progressed) continue;
    for (let i = 0; i < N; i++) {
      if (!st.cand[i]) continue;
      const S = { cand: Uint8Array.from(st.cand), rowP: st.rowP.slice(), colP: st.colP.slice(), regP: st.regP.slice() };
      place(S, i);
      const d = dead(S);
      if (!d) continue;
      st.cand[i] = 0; progressed = true;
      if (marks[i] !== 1) return { kind: 'elim', cells: [i], why: d.cells, text: `A queen in the marked cell would leave ${d.text} without a single cell. Cross it out.` };
      break;
    }
    if (!progressed) return null;
  }
  return null;
}

function giveHint() {
  const sol = new Set(lv.solution.map((c, r) => r * n + c));
  const wrong = marks.findIndex((m, i) => m === 2 && !sol.has(i));
  if (wrong >= 0) { hint = { cells: new Set([wrong]), why: new Set(), kind: 'wrong' }; return { text: 'The marked queen is in the wrong place. Remove it or move it.' }; }
  const h = computeHint();
  if (h) { hint = { cells: new Set(h.cells), why: new Set(h.why), kind: h.kind }; return { text: h.text }; }
  for (let r = 0; r < n; r++) {
    const i = r * n + lv.solution[r];
    if (marks[i] !== 2) { hint = { cells: new Set([i]), why: new Set(), kind: 'place' }; return { text: 'A queen belongs here. The level can be solved from this cell.' }; }
  }
  return null;
}

// ---------- Rules ----------
// o: { n, grid, q: queens, x: crosses, bad: clashes, why: reason (stripes), hint: cell to act on, done: gold crowns }
// rows/cols give non-square examples (a single row, say); drag draws the finger's path through its cells.
function mini(o) {
  const R = o.rows || o.n, C = o.cols || o.n, g = o.grid, has = (a, i) => (a || []).includes(i);
  const wOf = (a, b) => (g[a] !== g[b] ? 2 : 0.75);
  return Grid.mini(Object.assign({ rows: R, cols: C }, o), {
    fill: (i) => `var(--r${g[i]})`,
    lines(at, s) {
      let ln = '';
      for (let r = 0; r < R; r++) for (let c = 1; c < C; c++) { const w = wOf(r * C + c - 1, r * C + c); ln += `M${at(c) - w / 2} ${at(r)}h${w}v${s}h${-w}z`; }
      for (let r = 1; r < R; r++) for (let c = 0; c < C; c++) { const w = wOf((r - 1) * C + c, r * C + c); ln += `M${at(c)} ${at(r) - w / 2}h${s}v${w}h${-s}z`; }
      for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
        const m = Math.max(wOf((r - 1) * C + c - 1, r * C + c - 1), wOf((r - 1) * C + c, r * C + c), wOf((r - 1) * C + c - 1, (r - 1) * C + c), wOf(r * C + c - 1, r * C + c));
        ln += `M${at(c) - m / 2} ${at(r) - m / 2}h${m}v${m}h${-m}z`;
      }
      return ln;
    },
    mark(i, x, y, s, bad) {
      if (has(o.q, i)) return `<path d="${CROWN_D}" transform="translate(${x + s * 0.205} ${y + s * 0.205}) scale(${(s * 0.59) / 24})" style="fill:${bad ? '#1a0c0c' : o.done ? 'var(--accent)' : '#f6f3ea'}"/>`;
      if (has(o.x, i)) return `<path d="M${x + 9} ${y + 9}l6 6m0-6l-6 6" stroke="rgba(255,255,255,.6)" stroke-width="1.6" stroke-linecap="round"/>`;
      return '';
    },
    after(at, s) {
      if (!o.drag) return '';
      // The finger's path: from a dot in the first cell to an arrowhead in the last, low in the cells so the crosses show.
      const a = o.drag[0], z = o.drag[o.drag.length - 1], y0 = o.drag[o.drag.length - 2];
      const cx = (i) => at(i % C) + s / 2, cy = (i) => at((i / C) | 0) + s * 0.8;
      const pts = o.drag.map((i) => `${cx(i)} ${cy(i)}`).join(' L');
      const dx = Math.sign(cx(z) - cx(y0)), dy = Math.sign(cy(z) - cy(y0));
      return `<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9">`
        + `<path d="M${pts}"/><path d="M${cx(z) - 3.5 * dx - 3 * dy} ${cy(z) - 3.5 * dy + 3 * dx}L${cx(z)} ${cy(z)}L${cx(z) - 3.5 * dx + 3 * dy} ${cy(z) - 3.5 * dy - 3 * dx}"/></g>`
        + `<circle cx="${cx(a)}" cy="${cy(a)}" r="2.4" fill="#fff" opacity=".9"/>`;
    },
  });
}

function rulesHtml() {
  // A 5 x 5 example with five regions. Its solution, row by row, is column 1, 3, 0, 2, 4.
  const G = [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 2, 0, 0, 3, 1, 2, 2, 3, 3, 4, 2, 2, 3, 4, 4].map((r) => [0, 5, 3, 6, 1][r]);
  const B = (o) => mini(Object.assign({ n: 5, grid: G }, o));
  const at = (r, c) => r * 5 + c;
  // The cells a queen on (1, 3) blocks: its row, column, region and neighbours.
  const q0 = at(1, 3), blocked = [];
  for (let i = 0; i < 25; i++) {
    const r = (i / 5) | 0, c = i % 5;
    if (i !== q0 && (r === 1 || c === 3 || G[i] === G[q0] || (Math.abs(r - 1) <= 1 && Math.abs(c - 3) <= 1))) blocked.push(i);
  }
  const one = (m) => mini(Object.assign({ n: 1, grid: [5] }, m));
  const card = Rules.card;
  return [
    card('01', 'The goal', 'Place one queen in every row, every column and every colour region. A board with five rows has five queens.',
      B({ q: [at(0, 1), at(1, 3), at(2, 0), at(3, 2), at(4, 4)], done: true, label: 'A solved board' }), Rules.RIGHT),
    card('02', 'One per row and column', 'Two queens may never share a row, and never share a column.',
      B({ q: [at(0, 1), at(0, 4)], bad: [at(0, 1), at(0, 4)], label: 'Two queens in the same row' }), Rules.WRONG),
    card('03', 'One per colour region', 'Every coloured region has exactly one queen, however big it is.',
      B({ q: [at(1, 0), at(2, 2)], bad: [at(1, 0), at(2, 2)], label: 'Two queens in the same region' }), Rules.WRONG),
    card('04', 'Queens may not touch', 'Not even diagonally. The eight cells around a queen are always empty.',
      B({ q: [at(3, 2), at(4, 3)], bad: [at(3, 2), at(4, 3)], label: 'Two queens touching diagonally' }), Rules.WRONG),
    `<section class="rule col"><div><h3><span class="n">05</span>How to mark</h3><p>Tap a cell to cycle through cross, queen and empty.</p></div>
      <div class="taps"><div>${one({ x: [0] })}1 tap<br>cross</div><div>${one({ q: [0] })}2 taps<br>queen</div><div>${one({})}3 taps<br>empty</div></div>
      <p><b>Press and drag</b> along a row or a column to cross several cells at once, and turn a corner to go on along another. Queens are left alone. Start on a cross to erase crosses instead.</p>
      <div class="dragdemo">${mini({ rows: 1, cols: 5, grid: [5, 5, 3, 3, 3], x: [0, 1, 2, 3, 4], drag: [0, 1, 2, 3, 4], label: 'Press and drag across a row: every cell is crossed' })}<span>press and drag: crosses on all</span></div></section>`,
    card('06', 'Cross out what cannot be', 'Put a cross where a queen cannot go. Every queen closes its row, column and region, and the cells around it.',
      B({ q: [q0], x: blocked, label: 'A queen and every cell it closes, crossed out' })),
    card('07', 'Stuck? Tap Hint', 'Hint shows the next logical step. The stripes show why, the white frame shows the cell to change.',
      B({ q: [at(0, 1), at(1, 3), at(2, 0), at(3, 2)], x: [at(3, 4), at(4, 3)], why: [at(3, 4), at(4, 3), at(4, 4)], hint: [at(4, 4)], label: 'Hint: the last region has only one cell left' })),
  ].join('');
}

Puzzles.register({
  id: 'queens', name: 'Queens', tagline: 'One queen in every row, column and colour region.', accent: '#e3b341',
  logo: __LOGO__,
  levels: LEVELS,
  subtitle: (l) => `${l.n} × ${l.n}`,
  sections: () => [6, 7, 8, 9].map((s) => ({ title: `${s} × ${s}`, items: LEVELS.filter((l) => l.n === s) })).filter((s) => s.items.length),
  init,
  load(l) { lv = l; n = l.n; marks = new Array(n * n).fill(0); clearHint(); cells = Grid.build(board, n); fit(); },
  render: paint,
  resize: fit,
  snapshot: () => marks.slice(),
  restore(s) { marks = s.slice(); },
  reset() { marks = new Array(n * n).fill(0); },
  started: () => marks.some((m) => m),
  solved: () => marks.filter((m) => m === 2).length === n && conflicts().size === 0,
  status() {
    const bad = conflicts().size > 0;
    return { count: `Queens <b>${marks.filter((m) => m === 2).length}</b> of ${n}`, msg: bad ? 'Two queens clash.' : 'Tap: cross, queen, empty.', bad };
  },
  hint: giveHint,
  clearHint,
  rulesHtml,
  // For the tests in test/.
  dbg: { get marks() { return marks; }, set marks(v) { marks = v; }, get hint() { return hint; }, get lv() { return lv; }, get n() { return n; } },
});
