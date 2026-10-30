// Matrix: the engine. A level is a 3 x 3 matrix of panels with the last one missing, and eight answers to choose
// from, in the style of the matrix tests (Raven's progressive matrices) used to admit members to high-IQ societies.
// Every panel is built from components (one shape, two shapes, a grid of shapes, a figure of lines, an arrow, ...),
// and every attribute of a component (shape, size, shade, count, places, lines, direction, ...) follows a rule
// along the rows, down the columns or along the diagonals.
//
// The answers are made the way I-RAVEN makes them: three attributes of the right answer are each given one wrong
// value, and the eight answers are every combination of right and wrong. So every wrong value shows up in exactly
// half of the answers and the right answer cannot be spotted by counting which values are most common.
//
// accepts() is the judge: an answer is accepted when every attribute is explained by some rule in the catalogue,
// along some direction. A level is only kept when the right answer is the one answer accepted, which is what
// "exactly one solution" means here. games/matrix/verify.py checks the same thing independently.
'use strict';

// Each layout is a list of components. A component's values in a panel are a small array:
//   shape [t, s, c]     shape, size, shade
//   grid  [p, t, s, c]  p: bitmask of the filled places, then shape, size and shade of all of them
//   lines [l]           bitmask of the strokes drawn
//   arrow [o, h, n]     direction (0 up, then clockwise in eighths), where the heads sit (tip, middle, tail), how many
//   hinge [o, a, c]     direction the arms open, how wide (narrow, medium, wide), shade of the hinge (white, grey, black)
//   bar   [q, d]        squares and dots: two layers on the same four places at the ends of a bar, above and below
//   post  [z]           four places beside the ends of a post, each empty, a dot or a square (base 3, one digit each)
//   bow   [f]           a triangle on either side of each end of an axis, each none, white or dark (base 3)
//   scale [b, w, t]     black and white pieces counted plus on the left and minus on the right (up to two), and their shape
//   row3  [x, y, z]     three shapes in a row, each a shape and black or white (item = shape * 2 + black)
// The numbers say how many values an attribute can take (shapes: triangle, square, pentagon, hexagon, circle;
// shades: white to black). n is the number of places in a grid or strokes in a figure.
// turn: where each place or stroke goes when the figure turns one step clockwise. A 2 x 2 grid turns a quarter, a
// 3 x 3 grid moves its outer eight places one place round the frame (the centre stays), a ring moves one place, and
// a line figure turns a quarter (the sides go round, the diagonals and the middle lines swap, the ring stays).
// mirror: where each place goes when the figure is turned over.
const TURN = {
  4: [1, 3, 0, 2],
  9: [1, 2, 5, 0, 4, 8, 3, 6, 7],
  8: [1, 2, 3, 4, 5, 6, 7, 0],
  lines: [1, 2, 3, 0, 5, 4, 7, 6, 8],
};
// The bar's places: 0 left above, 1 right above, 2 right below, 3 left below. Turned over the bar, above and below swap.
const MIRROR = { bar: [3, 2, 1, 0] };
const LAYOUTS = {
  centre: [{ kind: 'shape', slot: 'c', t: 5, s: 5, c: 5 }],
  lr: [{ kind: 'shape', slot: 'l', t: 5, s: 4, c: 5 }, { kind: 'shape', slot: 'r', t: 5, s: 4, c: 5 }],
  oi: [{ kind: 'shape', slot: 'o', t: 5, s: 1, c: 3 }, { kind: 'shape', slot: 'i', t: 5, s: 4, c: 5 }],
  grid4: [{ kind: 'grid', n: 4, t: 5, s: 3, c: 5, turn: TURN[4] }],
  grid9: [{ kind: 'grid', n: 9, t: 5, s: 3, c: 5, turn: TURN[9] }],
  lines: [{ kind: 'lines', n: 9, turn: TURN.lines }],
  // Eight small shapes on a ring round the frame, and one shape in the middle.
  rc: [{ kind: 'grid', n: 8, ring: true, t: 5, s: 3, c: 5, turn: TURN[8] }, { kind: 'shape', slot: 'm', t: 5, s: 4, c: 5 }],
  arrow: [{ kind: 'arrow', o: 8, h: 3, n: 3 }],
  hinge: [{ kind: 'hinge', o: 8, a: 3, c: 3 }],
  bar: [{ kind: 'bar', n: 4, mirror: MIRROR.bar }],
  post: [{ kind: 'post' }],
  bow: [{ kind: 'bow' }],
  scale: [{ kind: 'scale', t: 5 }],
  row3: [{ kind: 'row3' }],
};
// The attributes of each kind of component, in the order they are stored (a grid's count n is worked out from p).
const ATTRS = {
  shape: ['t', 's', 'c'], grid: ['n', 'p', 't', 's', 'c'], lines: ['l'], arrow: ['o', 'h', 'n'], hinge: ['o', 'a', 'c'],
  bar: ['q', 'd'], post: ['z'], bow: ['f'], scale: ['b', 'w', 't'], row3: ['r'],
};
const STORE = { shape: 'tsc', grid: 'ptsc', lines: 'l', arrow: 'ohn', hinge: 'oac', bar: 'qd', post: 'z', bow: 'f', scale: 'bwt' };
// type: steps and orders only; num: also adds up; set: a set of places or strokes; cyc: a direction, round in
// eighths; tern: places of three states that add up going round; fold: an axis with triangles that fold over;
// seq: three items in a row that shift along.
const CLASS = { t: 'type', s: 'num', c: 'num', n: 'num', p: 'set', l: 'set', o: 'cyc', h: 'type', a: 'type', q: 'set', d: 'set', z: 'tern', f: 'fold', b: 'num', w: 'num', r: 'seq' };
// Attributes that are a whole pattern: they can be given more than one wrong value at once.
const MULTI = new Set(['set', 'tern', 'fold', 'seq']);

const pop = (m) => { let k = 0; for (; m; m >>= 1) k += m & 1; return k; };
// Base 3, one digit per place (post and bow).
const dig = (v, i) => Math.floor(v / 3 ** i) % 3;
const digits = (v) => [0, 1, 2, 3].map((i) => dig(v, i));
const undigits = (ds) => ds.reduce((t, x, i) => t + x * 3 ** i, 0);
// A row of three items, as one number.
const items = (v) => [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10];
const unitems = (xs) => xs[0] * 100 + xs[1] * 10 + xs[2];

function get(spec, v, a) {
  if (spec.kind === 'row3') return unitems(v);
  if (a === 'n' && spec.kind === 'grid') return pop(v[0]);
  return v[STORE[spec.kind].indexOf(a)];
}
// The component v with attribute a set to x (a new array).
function put(spec, v, a, x) {
  if (spec.kind === 'row3') return items(x);
  const o = v.slice();
  o[STORE[spec.kind].indexOf(a)] = x;
  return o;
}
// The lowest and highest value of a number-like attribute.
function span(spec, a) {
  if (a === 'n') return [1, spec.n];
  if (a === 'b' || a === 'w') return [-2, 2];
  if (a === 'o') return [0, 7];
  return [0, spec[a] - 1];
}

// ---------- Rules ----------
// The catalogue the judge knows. Steps go up or down by one or two; add and sub make the third value from the first
// two; dist puts the same three values in every line, in a new order; or, and, xor and minus combine two sets, and
// orm, andm, xorm do the same and then turn the figure over; cw1, ccw1 and cw2 turn a set one step clockwise, one
// step anticlockwise or two steps at each panel. A direction turns by an eighth (cw1, ccw1) or a quarter (cw2,
// ccw2). Places of three states add up going round (add3: dot and dot make a square, dot and square cancel out).
// An axis folds one end at each step (frr: top to the right, then bottom to the right; fll, frl, flr likewise), and
// where two triangles land on each other the darker shows. Three items in a row shift one place left or right.
const RULES = {
  num: ['const', 'up1', 'down1', 'up2', 'down2', 'add', 'sub', 'dist'],
  type: ['const', 'up1', 'down1', 'up2', 'down2', 'dist'],
  set: ['const', 'dist', 'or', 'and', 'xor', 'minus', 'cw1', 'ccw1', 'cw2', 'orm', 'andm', 'xorm'],
  cyc: ['const', 'dist', 'cw1', 'ccw1', 'cw2', 'ccw2'],
  tern: ['const', 'dist', 'add3'],
  fold: ['const', 'dist', 'frr', 'fll', 'frl', 'flr'],
  seq: ['const', 'dist', 'shl', 'shr'],
};
const TURNS = { cw1: 1, ccw1: -1, cw2: 2 };
const CYC = { cw1: 1, ccw1: -1, cw2: 2, ccw2: -2 };
const OPS = { or: (a, b) => a | b, and: (a, b) => a & b, xor: (a, b) => a ^ b, minus: (a, b) => a & ~b };
const MIRRORED = { orm: 'or', andm: 'and', xorm: 'xor' };
// Which way the top, then the bottom, folds: 1 to the right, 0 to the left.
const FOLDS = { frr: [1, 1], fll: [0, 0], frl: [1, 0], flr: [0, 1] };
// How many steps of perm make a full turn (the least common multiple of its cycles): 8 for the frame of a 3 x 3
// grid, 4 for a line figure. Negative steps go the other way.
function period(perm) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const seen = new Set();
  let p = 1;
  for (let i = 0; i < perm.length; i++) {
    let len = 0;
    for (let j = i; !seen.has(j); j = perm[j]) { seen.add(j); len++; }
    if (len) p = (p * len) / gcd(p, len);
  }
  return p;
}
// The set m with every place moved once by perm.
function move(m, perm) {
  let out = 0;
  for (let b = 0; b < perm.length; b++) if (m >> b & 1) out |= 1 << perm[b];
  return out;
}
// The set m turned by `times` steps of perm.
function turn(m, perm, times) {
  const n = period(perm), k = ((times % n) + n) % n;
  for (let i = 0; i < k; i++) m = move(m, perm);
  return m;
}
// Places of three states added (s = 1) or taken away (s = -1), place by place, going round after two.
const add3 = (a, b, s = 1) => undigits(digits(a).map((x, i) => (x + s * dig(b, i) + 3) % 3));
// One end of the axis (0 top, 1 bottom) folds over to the right (or the left): the triangle on the other side lands
// on the one there, and the darker shows (cover = Math.min: the lighter, a likely mistake).
const ENDS = [[0, 1], [3, 2]]; // [left, right] place at the top and at the bottom
function foldEnd(v, end, right, cover = Math.max) {
  const d = digits(v), [L, R] = ENDS[end], from = right ? L : R, to = right ? R : L;
  d[to] = d[to] && d[from] ? cover(d[to], d[from]) : d[to] || d[from];
  d[from] = 0;
  return undigits(d);
}
const shl = (v) => { const [x, y, z] = items(v); return unitems([y, z, x]); };
const shr = (v) => { const [x, y, z] = items(v); return unitems([z, x, y]); };
const STEP = { up1: 1, down1: -1, up2: 2, down2: -2 };

function tripleOk(cls, k, a, b, c, spec) {
  if (k === 'const') return a === b && b === c;
  switch (cls) {
    case 'cyc': return b === (a + CYC[k] + 8) % 8 && c === (b + CYC[k] + 8) % 8;
    case 'tern': return c === add3(a, b);
    case 'fold': return b === foldEnd(a, 0, FOLDS[k][0]) && c === foldEnd(b, 1, FOLDS[k][1]);
    case 'seq': { const f = k === 'shl' ? shl : shr; return b === f(a) && c === f(b); }
    case 'set':
      if (k in TURNS) return !!spec.turn && b === turn(a, spec.turn, TURNS[k]) && c === turn(b, spec.turn, TURNS[k]);
      if (k in MIRRORED) return !!spec.mirror && c === move(OPS[MIRRORED[k]](a, b), spec.mirror);
      return c === OPS[k](a, b);
    default:
      if (k === 'add') return c === a + b;
      if (k === 'sub') return c === a - b;
      return b === a + STEP[k] && c === b + STEP[k];
  }
}
// Does rule k hold on every one of these lines (each three values)?
function holds(cls, k, lines, spec) {
  if (k === 'dist') {
    const key = (t) => t.slice().sort((x, y) => x - y).join(',');
    return lines.every((t) => new Set(t).size === 3 && key(t) === key(lines[0]));
  }
  return lines.every((t) => tripleOk(cls, k, t[0], t[1], t[2], spec));
}
// The lines a rule can run along, each from the top (or left) down. The diagonals carry on from the other side of
// the grid. In every direction the line through the gap (panel 8) comes last, so the first two are complete.
const LINES = {
  rows: [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
  cols: [[0, 3, 6], [1, 4, 7], [2, 5, 8]],
  diag: [[1, 5, 6], [2, 3, 7], [0, 4, 8]], // down to the right
  anti: [[0, 5, 7], [2, 4, 6], [1, 3, 8]], // down to the left
};
const DIRS = Object.keys(LINES);
const take = (v, ls) => ls.map((l) => l.map((i) => v[i]));

// The rule that explains nine values along some direction, or null.
function explain(cls, v, spec) {
  for (const k of RULES[cls]) for (const d of DIRS) if (holds(cls, k, take(v, LINES[d]), spec)) return { k, dir: d };
  return null;
}
// An attribute is free when no rule holds on the two complete lines of any direction: nothing in the matrix pins it
// down (where the shapes sit in a grid whose rule is about how many there are, for instance).
function free(cls, v, spec) {
  return !RULES[cls].some((k) => DIRS.some((d) => holds(cls, k, take(v, LINES[d].slice(0, 2)), spec)));
}
// cells: the eight panels shown; option: a ninth. True when every attribute is free or explained by a rule.
function accepts(layout, cells, option) {
  return LAYOUTS[layout].every((spec, ci) => ATTRS[spec.kind].every((a) => {
    const v = cells.map((p) => get(spec, p[ci], a));
    v.push(get(spec, option[ci], a));
    return free(CLASS[a], v, spec) || !!explain(CLASS[a], v, spec);
  }));
}

// ---------- Generating ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// Three rows of three that follow rule k. row() makes one candidate row or null; rows differ from each other
// where the rule allows it, so "the same along the row" is not also "the same everywhere". rand() makes a value,
// for dist.
function rows3(r, k, row, rand) {
  if (k === 'dist') {
    const s = new Set();
    for (let g = 0; g < 100 && s.size < 3; g++) s.add(rand());
    if (s.size < 3) return null;
    const vals = [...s], dir = r() < 0.5 ? 1 : 2;
    const out = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(vals[(j + i * dir) % 3]);
    return out;
  }
  const got = [];
  for (let g = 0; g < 200 && got.length < 3; g++) {
    const t = row();
    if (!t) continue;
    if (g < 150 && got.some((u) => u.join() === t.join())) continue;
    got.push(t);
  }
  return got.length === 3 ? got.flat() : null;
}
function numValues(r, k, lo, hi) {
  return rows3(r, k, () => {
    const a = int(r, lo, hi), b = int(r, lo, hi);
    if (k === 'const') return [a, a, a];
    if (k === 'add') return a + b <= hi && a + b >= lo ? [a, b, a + b] : null;
    if (k === 'sub') return a - b >= lo && a - b <= hi ? [a, b, a - b] : null;
    const d = STEP[k];
    return a + 2 * d >= lo && a + 2 * d <= hi ? [a, a + d, a + 2 * d] : null;
  }, () => int(r, lo, hi));
}
function cycValues(r, k) {
  return rows3(r, k, () => {
    const a = int(r, 0, 7), s = CYC[k] || 0;
    return [a, (a + s + 8) % 8, (a + 2 * s + 16) % 8];
  }, () => int(r, 0, 7));
}
function setValues(r, k, spec, lo, hi) {
  const bits = spec.n, empty = !!spec.mirror; // a layer of the bar may be empty
  const rand = () => { for (;;) { const m = int(r, 1, (1 << bits) - 1), n = pop(m); if (n >= lo && n <= hi) return m; } };
  return rows3(r, k, () => {
    const a = rand(), b = rand();
    if (k === 'const') return [a, a, a];
    if (k in TURNS) {
      const b2 = turn(a, spec.turn, TURNS[k]), c2 = turn(b2, spec.turn, TURNS[k]);
      return b2 !== a && c2 !== a && c2 !== b2 ? [a, b2, c2] : null;
    }
    const op = MIRRORED[k] || k;
    if ((op === 'xor' || op === 'minus') && !(a & b)) return null; // something must cancel, or it is just or
    let c = OPS[op](a, b);
    if (k in MIRRORED) {
      const m = move(c, spec.mirror);
      if (m === c) return null; // turning over must show
      c = m;
    }
    return (c || empty) && c !== a && c !== b ? [a, b, c] : null;
  }, rand);
}
// Post: one to three places taken; adding goes round at least once in every row (dot and dot, or dot and square).
function ternValues(r, k) {
  const rand = () => { for (;;) { const v = int(r, 1, 80), n = digits(v).filter(Boolean).length; if (n <= 3) return v; } };
  return rows3(r, k, () => {
    const a = rand(), b = rand();
    if (k === 'const') return [a, a, a];
    const c = add3(a, b);
    return c && c !== a && c !== b && digits(a).some((x, i) => x && dig(b, i)) ? [a, b, c] : null;
  }, rand);
}
// Bow: both folds move something, and at least one lands on a triangle that is there.
function foldValues(r, k) {
  const rand = () => int(r, 1, 80);
  return rows3(r, k, () => {
    const a = rand();
    if (k === 'const') return [a, a, a];
    const [ft, fb] = FOLDS[k], d = digits(a);
    const fromTop = ft ? 0 : 1, fromBot = fb ? 3 : 2;
    if (!d[fromTop] || !d[fromBot] || !(d[0] && d[1]) && !(d[2] && d[3])) return null;
    const b = foldEnd(a, 0, ft);
    return [a, b, foldEnd(b, 1, fb)];
  }, rand);
}
// Row3: three items, not all the same, mostly not all of one colour.
function seqValues(r, k) {
  const rand = () => {
    for (;;) {
      const xs = [int(r, 0, 9), int(r, 0, 9), int(r, 0, 9)];
      if (new Set(xs).size > 1 && new Set(xs.map((x) => x & 1)).size > 1) return unitems(xs);
    }
  };
  return rows3(r, k, () => {
    const a = rand();
    if (k === 'const') return [a, a, a];
    const f = k === 'shl' ? shl : shr;
    return [a, f(a), f(f(a))];
  }, rand);
}
function randomMask(r, bits, n) {
  return shuffle(r, range(0, bits - 1)).slice(0, n).reduce((m, i) => m | (1 << i), 0);
}

// Grids, figures and bars: how many places or strokes a random set has.
const SET_SIZE = { 4: [1, 3], 8: [1, 3], 9: [2, 5], lines: [2, 4], bar: [1, 3] };
// A rule along another direction is made as a rule along the rows and the lines laid out that way.
function place(v, d) {
  const out = new Array(9);
  LINES[d].forEach((line, i) => line.forEach((cell, j) => { out[cell] = v[i * 3 + j]; }));
  return out;
}
function values(r, spec, a, k) {
  switch (CLASS[a]) {
    case 'set': return setValues(r, k, spec, ...SET_SIZE[spec.kind === 'grid' ? spec.n : spec.kind]);
    case 'cyc': return cycValues(r, k);
    case 'tern': return ternValues(r, k);
    case 'fold': return foldValues(r, k);
    case 'seq': return seqValues(r, k);
    default: {
      // Shapes in steps go triangle, square, pentagon, hexagon: one more corner each; the circle has none to count.
      const [lo, hi] = span(spec, a);
      return numValues(r, k, lo, a === 't' && k !== 'const' && k !== 'dist' ? 3 : hi);
    }
  }
}

// One component across the nine panels. plan: { attribute: rule } for the attributes that vary, the rest are const;
// dirs: { attribute: 'cols' | 'diag' | 'anti' } for the rules that do not run along the rows.
// Returns { vals: [9 component arrays], rules: [{ a, k, d? }] } or null.
function genComponent(r, spec, plan, dirs) {
  const rules = [];
  const orient = (a, k, v) => {
    const ru = { a, k };
    if (dirs[a]) ru.d = dirs[a];
    rules.push(ru);
    return v && place(v, ru.d || 'rows');
  };
  const gen = (a) => { const k = plan[a] || 'const'; return orient(a, k, values(r, spec, a, k)); };
  if (spec.kind === 'grid') {
    let p;
    if (plan.n) {
      const n = orient('n', plan.n, numValues(r, plan.n, 1, spec.n));
      p = n && n.map((x) => randomMask(r, spec.n, x));
    } else p = gen('p');
    const t = gen('t'), s = gen('s'), c = gen('c');
    return p && t && s && c && { vals: p.map((_, i) => [p[i], t[i], s[i], c[i]]), rules };
  }
  const cols = ATTRS[spec.kind].map(gen);
  if (cols.some((x) => !x)) return null;
  return { vals: range(0, 8).map((i) => (spec.kind === 'row3' ? items(cols[0][i]) : cols.map((x) => x[i]))), rules };
}

// The attributes that must follow a rule other than const in every level of a layout: a grid that never changes is
// a poor puzzle. 'np' is a grid's count or places, one choice.
const MUST = { grid: ['np'], lines: ['l'], arrow: ['o'], hinge: ['o'], bar: ['q', 'd'], post: ['z'], bow: ['f'], scale: ['b', 'w'], row3: ['r'], shape: [] };
// Which list in a tier's kinds an attribute draws its rule from.
const KIND_OF = { t: 'type', s: 'num', c: 'num', n: 'num', h: 'type', a: 'type', o: 'o', q: 'q', d: 'q', z: 'z', f: 'f', r: 'r', b: 'sg', w: 'sg', l: 'l', p: 'p' };
// A panel that must show something: a grid needs a place, a figure a line, a post or bow a piece.
const shows = (spec, v) => (spec.kind === 'grid' || spec.kind === 'lines' || spec.kind === 'post' || spec.kind === 'bow' ? v[0] !== 0 : true);

// The likeliest mistakes about a whole pattern x, from the two panels before the gap on the rule's line (A, B):
// copied a neighbour, turned or folded the wrong way, combined the wrong way.
function mistakes(spec, ru, x, P) {
  const [i, j] = LINES[ru.d || 'rows'][2], A = P(i), B = P(j);
  switch (CLASS[ru.a]) {
    case 'set': {
      const out = [B, A, A | B, A ^ B, A & B, A & ~B, B & ~A];
      if (spec.turn) out.push(turn(x, spec.turn, 1), turn(x, spec.turn, -1), turn(x, spec.turn, 2));
      if (spec.mirror) out.push(move(x, spec.mirror), move(A | B, spec.mirror), move(A & B, spec.mirror), move(A ^ B, spec.mirror));
      return out;
    }
    case 'tern': return [B, A, add3(A, B, -1), add3(B, A, -1), undigits(digits(A).map((y, k) => Math.max(y, dig(B, k)))), undigits(digits(A).map((y, k) => Math.min(2, y + dig(B, k))))];
    case 'fold': {
      const [, fb] = FOLDS[ru.k] || [1, 1];
      return [B, foldEnd(B, 1, 1 - fb), foldEnd(B, 1, fb, Math.min), foldEnd(B, 0, 0), foldEnd(B, 0, 1), foldEnd(foldEnd(B, 0, 1 - fb), 1, fb)];
    }
    default: return [B, A, shl(B), shr(B), shl(shl(B)), shl(A), shr(A)];
  }
}
// Small changes to a whole pattern, each its own: flip a place, change a place's state, swap or recolour an item.
function tweaks(spec, a) {
  const cls = CLASS[a];
  if (cls === 'set') return range(0, spec.n - 1).map((b) => ({ id: b, f: (x) => x ^ (1 << b) }));
  if (cls === 'tern' || cls === 'fold') return range(0, 3).map((b) => ({ id: b, f: (x) => undigits(digits(x).map((y, k) => (k === b ? (y + 1 + (b & 1)) % 3 : y))) }));
  return [
    { id: 's01', f: (x) => { const [p, q, s] = items(x); return unitems([q, p, s]); } },
    { id: 's12', f: (x) => { const [p, q, s] = items(x); return unitems([p, s, q]); } },
    ...[0, 1, 2].map((k) => ({ id: 'c' + k, f: (x) => unitems(items(x).map((y, m) => (m === k ? y ^ 1 : y))) })),
    ...[0, 1, 2].map((k) => ({ id: 't' + k, f: (x) => unitems(items(x).map((y, m) => (m === k ? ((y >> 1) + 1) % 5 * 2 + (y & 1) : y))) })),
  ];
}

// How hard each rule is to see, for sorting levels within a tier. A class:rule entry overrides the rule alone.
const WEIGHT = {
  const: 0, dist: 1, up1: 1, down1: 1, up2: 1.4, down2: 1.4, add: 2, sub: 2.2, or: 1.3, and: 1.8, xor: 2.2, minus: 2.2,
  cw1: 2, ccw1: 2, cw2: 1.8, orm: 2.6, andm: 2.8, xorm: 3, add3: 2.6, frr: 2.8, fll: 2.8, frl: 3.2, flr: 3.2, shl: 1.4, shr: 1.4,
  'cyc:cw1': 0.8, 'cyc:ccw1': 0.8, 'cyc:cw2': 1, 'cyc:ccw2': 1,
};
const weight = (ru) => WEIGHT[CLASS[ru.a] + ':' + ru.k] ?? WEIGHT[ru.k];
// Signed counts (scale) are harder than they look: plus on one side, minus on the other.
const BASE = { centre: 0, grid4: 0.5, lines: 0.5, grid9: 1, lr: 1.5, oi: 1.5, rc: 1.5, arrow: 0, hinge: 0.3, row3: 0.3, bar: 1, post: 1.2, bow: 1.5, scale: 1.5 };
// A rule that does not run along the rows, among rules that do.
const DIR_WEIGHT = { cols: 0.6, diag: 1.2, anti: 1.2 };

// opts: { seed, layout, vary (how many attributes follow a rule other than const), kinds: { type, num, n, p, l, o, q,
//   z, f, r, sg, nShare (how often a grid's rule is about the count rather than the places; 0.5 by default) },
//   dirs ({ cols, diag, anti }: the chance that a rule runs that way instead of along the rows) }
// Returns a level { layout, score, cells, options, answer, rules } or null when this seed gives nothing good.
function generateLevel({ seed, layout, vary, kinds, dirs: share = {} }) {
  const r = rng(seed), specs = LAYOUTS[layout];
  // The attributes that can vary: [component, attribute]; a grid's count and places are one choice ('np').
  const slots = [];
  specs.forEach((spec, ci) => {
    for (const a of spec.kind === 'grid' ? ['np', 't', 's', 'c'] : ATTRS[spec.kind]) {
      if (a === 'np' || MULTI.has(CLASS[a]) || span(spec, a)[1] > span(spec, a)[0]) slots.push([ci, a]);
    }
  });
  const must = slots.filter(([ci, a]) => MUST[specs[ci].kind].includes(a));
  const rest = shuffle(r, slots.filter((s) => !must.includes(s)));
  const chosen = must.concat(rest).slice(0, Math.max(vary, must.length));
  const plans = specs.map(() => ({}));
  for (const [ci, a] of chosen) {
    if (a === 'np') {
      const mode = kinds.n && kinds.p ? (r() < (kinds.nShare ?? 0.5) ? 'n' : 'p') : kinds.n ? 'n' : 'p';
      plans[ci][mode] = pick(r, kinds[mode]);
    } else plans[ci][a] = pick(r, kinds[KIND_OF[a]]);
  }
  const dirs = specs.map((spec) => {
    const d = {};
    for (const a of ATTRS[spec.kind]) {
      let x = r();
      for (const w of ['cols', 'diag', 'anti']) {
        if (x < (share[w] || 0)) { d[a] = w; break; }
        x -= share[w] || 0;
      }
    }
    return d;
  });
  const comps = specs.map((spec, ci) => genComponent(r, spec, plans[ci], dirs[ci]));
  if (comps.some((c) => !c)) return null;
  const panels = range(0, 8).map((i) => comps.map((c) => c.vals[i]));
  if (panels.some((p) => p.some((v, ci) => !shows(specs[ci], v)))) return null;
  const cells = panels.slice(0, 8), answer = panels[8];
  const rules = [];
  comps.forEach((c, ci) => c.rules.forEach((ru) => rules.push(Object.assign({ c: ci }, ru))));
  if (!accepts(layout, cells, answer)) return null;

  // ---------- The eight answers ----------
  // Splits: an attribute of the answer and a wrong value for it. Varying attributes first; a whole pattern (places,
  // lines, a post, a bow, a row of items) can be split more than once, by small changes on top of each other.
  const cands = [];
  const varying = shuffle(r, rules.filter((ru) => ru.k !== 'const'));
  const fixed = shuffle(r, rules.filter((ru) => ru.k === 'const' && !MULTI.has(CLASS[ru.a]) && span(specs[ru.c], ru.a)[1] > span(specs[ru.c], ru.a)[0]));
  for (const ru of varying.concat(fixed)) cands.push(ru);
  for (const ru of varying) if (MULTI.has(CLASS[ru.a])) cands.push(ru, ru);
  const colOf = (ci, a) => panels.map((p) => get(specs[ci], p[ci], a));

  for (let tries = 0; tries < 40; tries++) {
    const used = new Set(), splits = [];
    for (const ru of cands) {
      if (splits.length === 3) break;
      const spec = specs[ru.c], key = ru.c + ru.a, x = get(spec, answer[ru.c], ru.a);
      const set = (y) => (v) => put(spec, v, ru.a, y);
      if (MULTI.has(CLASS[ru.a])) {
        if (!used.has(key) && r() < 0.6) {
          // A likely mistake about the whole pattern comes before any small change on the same attribute, so the
          // changes apply on top of it.
          const pool = mistakes(spec, ru, x, (i) => get(spec, panels[i][ru.c], ru.a)).filter((y) => y !== x && shows(spec, put(spec, answer[ru.c], ru.a, y)));
          if (pool.length) {
            used.add(key);
            splits.push({ c: ru.c, f: set(pick(r, pool)) });
            continue;
          }
        }
        used.add(key);
        const pool = tweaks(spec, ru.a).filter((t) => !used.has(key + ':' + t.id));
        if (!pool.length) continue;
        // Mostly a place that is in play on the rule's last line: the likelier mistakes.
        let t = pick(r, pool);
        if (CLASS[ru.a] === 'set' && r() < 0.75) {
          const [i, j] = LINES[ru.d || 'rows'][2];
          const near = pool.filter((u) => (get(spec, panels[i][ru.c], ru.a) | get(spec, panels[j][ru.c], ru.a)) >> u.id & 1);
          if (near.length) t = pick(r, near);
        }
        used.add(key + ':' + t.id);
        splits.push({ c: ru.c, f: (v) => put(spec, v, ru.a, t.f(get(spec, v, ru.a))) });
      } else {
        if (used.has(key)) continue;
        used.add(key);
        // A wrong value, mostly one seen elsewhere in the matrix: a value from nowhere is too easy to rule out.
        const [lo, hi] = span(spec, ru.a);
        const dom = range(lo, hi).filter((y) => y !== x);
        const seen = dom.filter((y) => colOf(ru.c, ru.a).slice(0, 8).includes(y));
        const y = seen.length && r() < 0.8 ? pick(r, seen) : pick(r, dom);
        if (ru.a === 'n' && spec.kind === 'grid') { const mask = randomMask(r, spec.n, y); splits.push({ c: ru.c, f: (v) => put(spec, v, 'p', mask) }); }
        else splits.push({ c: ru.c, f: set(y) });
      }
    }
    if (splits.length < 3) return null;
    const options = range(0, 7).map((m) => {
      const o = answer.map((v) => v.slice());
      splits.forEach((s, j) => { if (m >> j & 1) o[s.c] = s.f(o[s.c]); });
      return o;
    });
    const keys = new Set(options.map((o) => JSON.stringify(o)));
    if (keys.size !== 8) continue;
    if (options.some((o) => o.some((v, ci) => !shows(specs[ci], v)))) continue;
    if (options.slice(1).some((o) => accepts(layout, cells, o))) continue;
    // Shuffle the answers; the right one is options[0] before the shuffle.
    const order = shuffle(r, range(0, 7));
    const score = BASE[layout] + rules.reduce((t, ru) => t + weight(ru) + (ru.d && ru.k !== 'const' ? DIR_WEIGHT[ru.d] : 0), 0);
    return { layout, score: Math.round(score * 10) / 10, cells, options: order.map((i) => options[i]), answer: order.indexOf(0), rules };
  }
  return null;
}

// ---------- Sets of levels ----------
// Matrix Test: how many questions of each tier a test of 25 or 50 has, with the weight on hard.
const TEST_MIX = { 25: { 1: 3, 2: 5, 3: 9, 4: 8 }, 50: { 1: 6, 2: 10, 3: 18, 4: 16 } };
// The rules each tier draws from (a rule listed twice is drawn twice as often). type: shapes, steps of the head or
// the angle; num: sizes, shades and counts; n: how many in a grid; p: which places; l: lines; o: directions;
// q: the layers of a bar; z: a post; f: a bow; r: a row of items; sg: signed counts. nShare: how often a grid's rule
// is about the count rather than the places.
const KINDS = {
  1: { type: ['dist', 'up1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist'], p: ['dist'], l: ['or'], o: ['cw1', 'cw2', 'dist'], r: ['shl', 'shr'] },
  2: {
    type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist', 'add'], p: ['dist', 'or', 'xor'], l: ['xor', 'and', 'or', 'dist'],
    o: ['cw1', 'ccw1', 'cw2', 'ccw2', 'dist'], r: ['shl', 'shr', 'dist'], q: ['or', 'xor', 'and'],
  },
  3: {
    type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist', 'up1'], p: ['xor', 'and', 'or', 'dist', 'minus'], l: ['xor', 'and', 'minus', 'cw1', 'ccw1', 'cw2'],
    o: ['cw1', 'ccw1', 'cw2', 'ccw2', 'dist'], r: ['shl', 'shr'], q: ['xor', 'and', 'minus', 'orm', 'andm'], z: ['add3'], sg: ['add', 'sub', 'add'],
  },
  4: {
    type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist'], p: ['cw1', 'ccw1', 'cw1', 'ccw1', 'cw2', 'xor'], l: ['cw1', 'ccw1', 'cw2', 'xor', 'and'], nShare: 0.3,
    o: ['cw1', 'ccw1', 'cw2', 'ccw2'], r: ['shl', 'shr'], q: ['andm', 'orm', 'xorm', 'xor'], z: ['add3'], f: ['frr', 'fll', 'frl', 'flr'], sg: ['add', 'sub'],
  },
};
// The chance, per attribute, that its rule runs down the columns or along a diagonal instead of along the rows.
const DIR_SHARE = { 1: {}, 2: {}, 3: {}, 4: { cols: 0.35, diag: 0.1, anti: 0.1 } };
// [tier, layout, how many attributes vary, directions (instead of the tier's)]. A tier takes its levels from its
// recipes in turn.
const DIAGONALS = { diag: 0.5, anti: 0.5 };
const PLAN = [
  [1, 'centre', 1], [1, 'centre', 2], [1, 'grid4', 1], [1, 'grid9', 1], [1, 'lines', 1], [1, 'lr', 1], [1, 'oi', 1], [1, 'arrow', 1], [1, 'hinge', 1], [1, 'row3', 1],
  [2, 'centre', 3], [2, 'grid4', 2], [2, 'grid9', 2], [2, 'lines', 1], [2, 'lr', 2], [2, 'oi', 2], [2, 'arrow', 2], [2, 'hinge', 2], [2, 'row3', 1], [2, 'bar', 2],
  [3, 'grid9', 3], [3, 'grid4', 3], [3, 'lr', 3], [3, 'lr', 4], [3, 'oi', 3], [3, 'oi', 4], [3, 'lines', 1], [3, 'centre', 3],
  [3, 'arrow', 3], [3, 'hinge', 3], [3, 'bar', 2], [3, 'post', 1], [3, 'scale', 2],
  [4, 'grid9', 3], [4, 'rc', 3], [4, 'rc', 4], [4, 'lines', 1], [4, 'oi', 4], [4, 'lr', 5],
  [4, 'bar', 2], [4, 'post', 1, { cols: 0.25, diag: 0.25, anti: 0.25 }], [4, 'bow', 1, { cols: 0.2, diag: 0.3, anti: 0.3 }], [4, 'row3', 1, DIAGONALS],
  [4, 'scale', 3, { cols: 0.3, diag: 0.15, anti: 0.15 }], [4, 'hinge', 3],
];
// A level's pattern: the layout and which attributes follow which rule, which way. No two levels share one, in
// any tier: two levels that only differ in which shapes and shades they use are the same puzzle twice.
const parts = (lv) => lv.rules.filter((r) => r.k !== 'const').map((r) => lv.layout + ':' + r.c + r.a + '=' + r.k + (r.d ? '|' + r.d : ''));
const signature = (lv) => parts(lv).sort().join(',');
// Unique patterns are not enough: a pattern that is another one plus a rule, or one rule turning up again and again,
// still feels like the same puzzle. So one rule (on one layout) is used at most `cap` times in a set, and within a
// tier no level's rules may all be found in another level of the same layout.
const contains = (a, b) => a.every((x) => b.includes(x)); // a's rules all in b
function fresh(lv, batch, seen, uses, cap) {
  if (seen.has(signature(lv))) return false;
  const ps = parts(lv);
  if (ps.some((x) => (uses.get(x) || 0) >= cap)) return false;
  return !batch.some((o) => o.layout === lv.layout && (contains(ps, parts(o)) || contains(parts(o), ps)));
}
// Two levels in a row should not look alike: same layout and a rule in common.
const alike = (a, b) => a.layout === b.layout && parts(a).some((x) => parts(b).includes(x));


// A set of levels: counts { tier: how many }, in order of tier and within a tier by score. The level bank is
// buildSet({ 1: 40, 2: 40, 3: 40, 4: 40 }) with the default seed; a test draws a fresh set from a random seed, its
// recipes taken in a shuffled order (else every short test would open with the same layouts). Returns
// { levels, report } or throws when a tier runs out of patterns.
function buildSet(counts, { seed = 90000, cap = 3, shuffled = false, tries = 3000 } = {}) {
  const levels = [], seen = new Set(), uses = new Map(), report = [];
  const r = rng(seed);
  for (const tier of Object.keys(counts).map(Number).sort()) {
    const batch = [];
    // Each recipe keeps its own run of seeds. A recipe that finds no new pattern in `tries` seeds has run out and
    // drops out, and the others fill its place.
    let recipes = PLAN.map((p, pi) => [p, pi]).filter(([p]) => p[0] === tier)
      .map(([[, layout, vary, dirs], pi]) => ({ layout, vary, dirs: dirs || DIR_SHARE[tier], seed: seed + tier * 100000 + pi * 10000, done: false, got: 0 }));
    if (shuffled) recipes = shuffle(r, recipes);
    while (batch.length < counts[tier]) {
      const live = recipes.filter((rc) => !rc.done);
      if (!live.length) throw new Error(`tier ${tier}: only ${batch.length} different patterns`);
      for (const rc of live) {
        if (batch.length === counts[tier]) break;
        let lv = null;
        for (let k = 0; k < tries && !lv; k++) {
          const got = generateLevel({ seed: rc.seed++, layout: rc.layout, vary: rc.vary, kinds: KINDS[tier], dirs: rc.dirs });
          if (got && fresh(got, batch, seen, uses, cap)) lv = got;
        }
        if (!lv) { rc.done = true; continue; }
        seen.add(signature(lv));
        for (const x of parts(lv)) uses.set(x, (uses.get(x) || 0) + 1);
        batch.push(Object.assign({ tier }, lv));
        rc.got++;
      }
    }
    batch.sort((a, b) => a.score - b.score);
    // In order of score, except that the next level is the easiest of the next dozen that does not look like the
    // level before it.
    while (batch.length) {
      const prev = levels[levels.length - 1];
      let k = batch.findIndex((lv, i) => i < 12 && !(prev && alike(prev, lv)));
      if (k < 0) k = 0;
      levels.push(batch.splice(k, 1)[0]);
    }
    report.push(`tier ${tier}: ` + recipes.map((rc) => `${rc.layout}/${rc.vary} ${rc.got}`).join(', '));
  }
  return { levels, report };
}

module.exports = {
  LAYOUTS, ATTRS, CLASS, RULES, KINDS, TEST_MIX, LINES, FOLDS, get, pop, dig, digits, items, turn, holds, explain, accepts, generateLevel, signature, buildSet,
};
