// Matrix: a 3 x 3 matrix of figures with the last one missing; pick the one of eight answers that completes it.
// Every row follows the same rules. Runs inside the Puzzles shell (src/shell/shell.js). Engine is
// games/matrix/engine.js: the layouts, the rules and the judge the levels were generated with.
const LEVELS = __LEVELS__;
const TIER_NAME = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const LETTER = 'ABCDEFGH';

// ---------- Drawing ----------
// A panel is drawn in a 100 x 100 box, black on paper, like a printed test.
const INK = '#1b1b1a';
const SHADE = ['#ffffff', '#cdcac2', '#96938b', '#5b5954', '#1d1c1a'];
// Shapes are scaled so that one size looks the same size whatever the shape: a triangle with the circle's radius
// looks small, a square looks big.
const NORM = [1.12, 0.98, 0.97, 0.96, 0.88];
// Where each kind of single shape sits, its radius for each size, and its stroke.
const SLOT = {
  c: { x: 50, y: 50, r: [14, 20, 26, 32, 38], w: 2.4 },
  l: { x: 27, y: 50, r: [8, 12.5, 17, 21.5], w: 2.2 },
  r: { x: 73, y: 50, r: [8, 12.5, 17, 21.5], w: 2.2 },
  o: { x: 50, y: 50, r: [40], w: 2.4 },
  i: { x: 50, y: 50, r: [8, 11.5, 15, 18.5], w: 2.2 },
};
const GRID = { 4: { at: [28, 72], r: [9, 13, 17], w: 2 }, 9: { at: [20, 50, 80], r: [6, 8.5, 11], w: 1.6 } };
// The strokes of a line figure, by bit: the four sides, both diagonals, the two middle lines, a ring in the centre.
const STROKES = ['M18 18H82', 'M82 18V82', 'M18 82H82', 'M18 18V82', 'M18 18L82 82', 'M82 18L18 82', 'M50 18V82', 'M18 50H82'];

function shape(t, x, y, r, fill, w) {
  const R = r * NORM[t], style = `fill="${fill}" stroke="${INK}" stroke-width="${w}"`;
  if (t === 4) return `<circle cx="${x}" cy="${y}" r="${R.toFixed(2)}" ${style}/>`;
  const n = t + 3, off = [-90, -45, -90, 0][t];
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (off + (360 * k) / n) * Math.PI / 180;
    pts.push((x + R * Math.cos(a)).toFixed(2) + ',' + (y + R * Math.sin(a)).toFixed(2));
  }
  return `<polygon points="${pts.join(' ')}" ${style} stroke-linejoin="round"/>`;
}

function panelBody(layout, p) {
  let h = '';
  Engine.LAYOUTS[layout].forEach((spec, ci) => {
    const v = p[ci];
    if (spec.kind === 'shape') {
      const s = SLOT[spec.slot];
      h += shape(v[0], s.x, s.y, s.r[v[1]], SHADE[v[2]], s.w);
    } else if (spec.kind === 'grid') {
      const g = GRID[spec.n], side = g.at.length;
      for (let k = 0; k < spec.n; k++) if (v[0] >> k & 1) h += shape(v[1], g.at[k % side], g.at[(k / side) | 0], g.r[v[2]], SHADE[v[3]], g.w);
    } else {
      // Faint corner dots give a figure of a few lines something to stand in.
      h += [18, 82].map((x) => [18, 82].map((y) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#b9b5ab"/>`).join('')).join('');
      let d = '';
      STROKES.forEach((s, k) => { if (v[0] >> k & 1) d += s; });
      if (d) h += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
      if (v[0] >> 8 & 1) h += `<circle cx="50" cy="50" r="13" fill="none" stroke="${INK}" stroke-width="3.6"/>`;
    }
  });
  return h;
}
const panelSvg = (layout, p) => `<svg viewBox="0 0 100 100" aria-hidden="true">${panelBody(layout, p)}</svg>`;

// ---------- State ----------
// out[i]: 0 open, 1 tried and wrong, 2 crossed out by a hint. shown[r]: the hint has named rule r.
// pick: the answer in the gap (only ever the right one; a wrong one is crossed out instead).
// t: a wrong answer or a hint has been used in this attempt. It sticks through Undo, so a star cannot be had by
// guessing and taking the guess back.
let ctx, board, root, lv, out, shown, pick, t, bad = false;
let flash = new Set(), hintKind = '';
let clean = store.get('matrix.clean', {});

function build() {
  const L = lv.layout;
  root.innerHTML = `<div class="mx-m" role="img" aria-label="Three rows of three figures, the last one missing">`
    + lv.cells.map((p) => `<div class="mx-c">${panelSvg(L, p)}</div>`).join('')
    + '<div class="mx-c mx-gap"></div></div>'
    + '<div class="mx-o">' + lv.options.map((p, i) => `<button type="button" class="mx-a" data-i="${i}">${panelSvg(L, p)}<span class="mx-l">${LETTER[i]}</span></button>`).join('') + '</div>';
  fit();
}
function fit() {
  const W = Math.floor(ctx.width());
  root.style.width = root.style.height = W + 'px';
}

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

// ---------- Hint ----------
const ATTR_WORD = { t: 'shape', s: 'size', c: 'shade', n: 'count', p: 'places', l: 'lines' };
const SIDE_WORD = { l: 'left', r: 'right', o: 'outer', i: 'inner' };
const SHAPE_NAME = ['triangle', 'square', 'pentagon', 'hexagon', 'circle'];
const SHADE_NAME = ['white', 'light grey', 'grey', 'dark grey', 'black'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const valueOf = (p, ru) => Engine.get(Engine.LAYOUTS[lv.layout][ru.c], p[ru.c], ru.a);

// What rule ru says, in words, as a full sentence.
function ruleText(ru) {
  const spec = Engine.LAYOUTS[lv.layout][ru.c], a = ru.a, k = ru.k;
  const label = cap(spec.kind === 'shape' && spec.slot !== 'c' ? SIDE_WORD[spec.slot] + ' ' + ATTR_WORD[a] : ATTR_WORD[a]);
  const row = [0, 1, 2].map((i) => valueOf(lv.cells[i], ru)).sort((x, y) => x - y);
  const steps = (one, many) => ({ up1: `one ${one}`, down1: `one ${many}`, up2: `two ${one}`, down2: `two ${many}` })[k];
  let s;
  if (k === 'const') s = { p: 'the same places are filled in every panel of a row', l: 'the same figure all along each row' }[a] || 'the same all along each row';
  else if (k === 'dist') {
    s = {
      t: `every row has a ${and(row.map((x) => SHAPE_NAME[x]))}`,
      s: 'every row has the same three sizes',
      c: `every row has ${and(row.map((x) => SHADE_NAME[x]))}`,
      n: `every row has ${and(row.map(String))} of them`,
      p: 'every row uses the same three patterns',
      l: 'every row uses the same three figures',
    }[a] + ', each time in a new order';
  } else if (a === 't') s = `${k === 'up1' ? 'one more corner' : 'one corner fewer'} at each step along the row`;
  else if (a === 's') s = `${k.startsWith('up') ? 'grows' : 'shrinks'} by ${k.endsWith('1') ? 'one size' : 'two sizes'} at each step along the row`;
  else if (a === 'c') s = `${k.endsWith('1') ? 'one shade' : 'two shades'} ${k.startsWith('up') ? 'darker' : 'lighter'} at each step along the row`;
  else if (a === 'n') {
    s = {
      add: 'the third panel has as many as the first two together',
      sub: 'the third panel has as many as the first, less the second',
    }[k] || `${steps('more', 'fewer')} at each step along the row`;
  } else if (a === 'p') {
    s = {
      or: 'the third panel fills every place that is filled in the first or the second',
      and: 'the third panel fills only the places filled in both the first and the second',
      xor: 'lay the first two panels on top of each other: a place filled in both goes empty, a place filled in one stays',
    }[k];
  } else {
    s = {
      or: 'the third figure is the first two laid on top of each other',
      and: 'the third figure keeps only the lines the first two share',
      xor: 'lay the first two figures on top of each other: lines in both cancel out, the rest stay',
    }[k];
  }
  return `${label}: ${s}.`;
}

// Hint names the rule that crosses out the most answers still open, and crosses them out (one undo step). With one
// answer left it points at it.
function giveHint() {
  if (pick >= 0) return null;
  const open = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !out[i]);
  const right = lv.options[lv.answer];
  let best = -1, cross = [];
  lv.rules.forEach((ru, ri) => {
    if (shown[ri]) return;
    const k = open.filter((i) => valueOf(lv.options[i], ru) !== valueOf(right, ru));
    if (k.length > cross.length) { best = ri; cross = k; }
  });
  if (best < 0) {
    flash = new Set([lv.answer]); hintKind = 'answer';
    return { label: 'Answer', text: `Only ${LETTER[lv.answer]} is left, and it fits every rule.` };
  }
  ctx.change(() => { shown[best] = 1; t = 1; bad = false; for (const i of cross) out[i] = 2; });
  flash = new Set(cross); hintKind = 'elim';
  const names = and(cross.map((i) => LETTER[i]));
  return { label: 'Rule', text: `${ruleText(lv.rules[best])} ${names} ${cross.length > 1 ? 'break' : 'breaks'} it.` };
}

function init(c) {
  ctx = c; board = c.board;
  board.innerHTML = '<div class="mx"></div>';
  root = board.firstChild;
  root.addEventListener('click', (e) => { const b = e.target.closest('.mx-a'); if (b) tap(+b.dataset.i); });
}

// ---------- Rules ----------
// Panels in a row on paper, the same as on the board. ps: panels (null for the gap), cols: panels per row.
function strip(layout, ps, cols, label, crossed = []) {
  const s = 100, g = 6, rows = Math.ceil(ps.length / cols), W = cols * s + (cols - 1) * g, H = rows * s + (rows - 1) * g;
  let h = `<svg class="mini" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">`;
  ps.forEach((p, i) => {
    const x = (i % cols) * (s + g), y = ((i / cols) | 0) * (s + g);
    h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="${p ? 'var(--mx-paper)' : 'var(--mx-gap)'}"/>`;
    h += p ? `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100">${panelBody(layout, p)}</svg>`
      : `<text x="${x + s / 2}" y="${y + s / 2 + 16}" text-anchor="middle" font-size="46" font-weight="700" style="fill:var(--accent);font-family:var(--display)">?</text>`;
    if (crossed.includes(i)) h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" style="fill:var(--bg)" opacity=".6"/><path d="M${x + 14} ${y + 14}L${x + s - 14} ${y + s - 14}" style="stroke:var(--muted)" stroke-width="5" stroke-linecap="round"/>`;
  });
  return h + '</svg>';
}
function rulesHtml() {
  const card = Rules.card;
  // Shapes go triangle, square, circle along every row; the shade gets one step darker down the rows.
  const goal = [[0, 2, 0], [1, 2, 0], [4, 2, 0], [1, 2, 2], [4, 2, 2], [0, 2, 2], [4, 2, 4], [0, 2, 4], null].map((v) => v && [v]);
  return [
    card('01', 'The goal', 'Every row of the grid follows the same rules. Work them out and pick the answer that completes the last row. Each level has exactly one right answer.',
      strip('centre', goal, 3, 'A grid of shapes with the last one missing')),
    card('02', 'Look along the rows', 'Shape, size, shade and count change in steps, come back in a new order, or stay the same. A figure can be made of several parts, each with its own rule.',
      strip('centre', [[[1, 0, 1]], [[1, 2, 1]], [[1, 4, 1]]], 3, 'A square that grows at each step')),
    card('03', 'Count', 'Sometimes it is how many there are, or which places are filled, that follows the rule.',
      strip('grid4', [[[1, 4, 1, 4]], [[3, 4, 1, 4]], [[7, 4, 1, 4]]], 3, 'One, two, then three dots')),
    card('04', 'Overlay', 'Sometimes the third figure is the first two laid on top of each other. In some levels lines in both cancel out.',
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
  legend: '<span class="t1"><i></i>Easy</span><span class="t2"><i></i>Medium</span><span class="t3"><i></i>Hard</span>',
  levelClass: (l) => 't' + l.tier,
  sections: () => [1, 2, 3].map((k) => ({ title: TIER_NAME[k], items: LEVELS.filter((l) => l.tier === k) })),
  badge: (l) => (clean[l.id] ? '★' : ''),
  init,
  load(l) {
    lv = l; out = new Array(8).fill(0); shown = new Array(l.rules.length).fill(0); pick = -1; t = 0; bad = false;
    flash = new Set(); hintKind = '';
    build();
  },
  render,
  resize: fit,
  snapshot: () => ({ out: out.slice(), shown: shown.slice(), pick, t }),
  restore(s) { out = s.out.slice(); shown = s.shown.slice(); pick = s.pick; t = Math.max(t, s.t); bad = false; },
  // Restart keeps the mark of a wrong answer or hint; restarting a solved level is a new attempt.
  reset() { if (ctx.finished) t = 0; out = new Array(8).fill(0); shown = new Array(lv.rules.length).fill(0); pick = -1; bad = false; },
  started: () => pick >= 0 || t > 0 || out.some(Boolean),
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
