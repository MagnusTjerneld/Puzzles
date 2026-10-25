// Matrix: the engine. A level is a 3 x 3 matrix of panels with the last one missing, and eight answers to choose
// from, in the style of the matrix tests (Raven's progressive matrices) used to admit members to high-IQ societies.
// Every panel is built from components (one shape, two shapes, a grid of shapes, a figure of lines), and every
// attribute of a component (shape, size, shade, count, places, lines) follows a rule along the rows.
//
// The answers are made the way I-RAVEN makes them: three attributes of the right answer are each given one wrong
// value, and the eight answers are every combination of right and wrong. So every wrong value shows up in exactly
// half of the answers and the right answer cannot be spotted by counting which values are most common.
//
// accepts() is the judge: an answer is accepted when every attribute is explained by some rule in the catalogue,
// along the rows or down the columns. A level is only kept when the right answer is the one answer accepted, which
// is what "exactly one solution" means here. games/matrix/verify.py checks the same thing independently.
'use strict';

// Each layout is a list of components. A component's values in a panel are a small array:
//   shape [t, s, c]     shape, size, shade
//   grid  [p, t, s, c]  p: bitmask of the filled places, then shape, size and shade of all of them
//   lines [l]           bitmask of the strokes drawn
// The numbers say how many values an attribute can take (shapes: triangle, square, pentagon, hexagon, circle;
// shades: white to black). n is the number of places in a grid or strokes in a figure.
// turn: where each place or stroke goes when the figure turns one step clockwise. A 2 x 2 grid turns a quarter, a
// 3 x 3 grid moves its outer eight places one place round the frame (the centre stays), a ring moves one place, and
// a line figure turns a quarter (the sides go round, the diagonals and the middle lines swap, the ring stays).
const TURN = {
  4: [1, 3, 0, 2],
  9: [1, 2, 5, 0, 4, 8, 3, 6, 7],
  8: [1, 2, 3, 4, 5, 6, 7, 0],
  lines: [1, 2, 3, 0, 5, 4, 7, 6, 8],
};
const LAYOUTS = {
  centre: [{ kind: 'shape', slot: 'c', t: 5, s: 5, c: 5 }],
  lr: [{ kind: 'shape', slot: 'l', t: 5, s: 4, c: 5 }, { kind: 'shape', slot: 'r', t: 5, s: 4, c: 5 }],
  oi: [{ kind: 'shape', slot: 'o', t: 5, s: 1, c: 3 }, { kind: 'shape', slot: 'i', t: 5, s: 4, c: 5 }],
  grid4: [{ kind: 'grid', n: 4, t: 5, s: 3, c: 5, turn: TURN[4] }],
  grid9: [{ kind: 'grid', n: 9, t: 5, s: 3, c: 5, turn: TURN[9] }],
  lines: [{ kind: 'lines', n: 9, turn: TURN.lines }],
  // Eight small shapes on a ring round the frame, and one shape in the middle.
  rc: [{ kind: 'grid', n: 8, ring: true, t: 5, s: 3, c: 5, turn: TURN[8] }, { kind: 'shape', slot: 'm', t: 5, s: 4, c: 5 }],
};
// The attributes of each kind of component. In a grid, n is the number of filled places and p which ones.
const ATTRS = { shape: ['t', 's', 'c'], grid: ['n', 'p', 't', 's', 'c'], lines: ['l'] };
const CLASS = { t: 'type', s: 'num', c: 'num', n: 'num', p: 'set', l: 'set' };

const pop = (m) => { let k = 0; for (; m; m >>= 1) k += m & 1; return k; };

function get(spec, v, a) {
  if (spec.kind === 'shape') return v['tsc'.indexOf(a)];
  if (spec.kind === 'lines') return v[0];
  return a === 'n' ? pop(v[0]) : v['ptsc'.indexOf(a)];
}

// ---------- Rules ----------
// The catalogue the judge knows. Steps go up or down by one or two; add and sub make the third value from the first
// two; dist puts the same three values in every row, in a new order; or, and, xor and minus combine two sets;
// cw1, ccw1 and cw2 turn a set one step clockwise, one step anticlockwise or two steps at each panel.
const RULES = {
  num: ['const', 'up1', 'down1', 'up2', 'down2', 'add', 'sub', 'dist'],
  type: ['const', 'up1', 'down1', 'up2', 'down2', 'dist'],
  set: ['const', 'dist', 'or', 'and', 'xor', 'minus', 'cw1', 'ccw1', 'cw2'],
};
const TURNS = { cw1: 1, ccw1: -1, cw2: 2 };
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
// The set m turned by `times` steps of perm.
function turn(m, perm, times) {
  const n = period(perm), k = ((times % n) + n) % n;
  for (let i = 0; i < k; i++) { let out = 0; for (let b = 0; b < perm.length; b++) if (m >> b & 1) out |= 1 << perm[b]; m = out; }
  return m;
}
const STEP = { up1: 1, down1: -1, up2: 2, down2: -2 };

function tripleOk(k, a, b, c, perm) {
  if (k in TURNS) return !!perm && b === turn(a, perm, TURNS[k]) && c === turn(b, perm, TURNS[k]);
  switch (k) {
    case 'const': return a === b && b === c;
    case 'add': return c === a + b;
    case 'sub': return c === a - b;
    case 'or': return c === (a | b);
    case 'and': return c === (a & b);
    case 'xor': return c === (a ^ b);
    case 'minus': return c === (a & ~b);
    default: return b === a + STEP[k] && c === b + STEP[k];
  }
}
// Does rule k hold on every one of these lines (each three values)?
function holds(k, lines, perm) {
  if (k === 'dist') {
    const key = (t) => t.slice().sort((x, y) => x - y).join(',');
    return lines.every((t) => new Set(t).size === 3 && key(t) === key(lines[0]));
  }
  return lines.every((t) => tripleOk(k, t[0], t[1], t[2], perm));
}
const ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
const COLS = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
const take = (v, ls) => ls.map((l) => l.map((i) => v[i]));

// The rule that explains nine values along the rows or down the columns, or null.
function explain(cls, v, perm) {
  for (const k of RULES[cls]) {
    if (holds(k, take(v, ROWS), perm)) return { k, dir: 'rows' };
    if (holds(k, take(v, COLS), perm)) return { k, dir: 'cols' };
  }
  return null;
}
// An attribute is free when no rule holds on the two complete rows, nor on the two complete columns: nothing in the
// matrix pins it down (where the shapes sit in a grid whose rule is about how many there are, for instance).
function free(cls, v, perm) {
  return !RULES[cls].some((k) => holds(k, take(v, ROWS.slice(0, 2)), perm) || holds(k, take(v, COLS.slice(0, 2)), perm));
}
// cells: the eight panels shown; option: a ninth. True when every attribute is free or explained by a rule.
function accepts(layout, cells, option) {
  return LAYOUTS[layout].every((spec, ci) => ATTRS[spec.kind].every((a) => {
    const v = cells.map((p) => get(spec, p[ci], a));
    v.push(get(spec, option[ci], a));
    const perm = CLASS[a] === 'set' ? spec.turn : null;
    return free(CLASS[a], v, perm) || !!explain(CLASS[a], v, perm);
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
// where the rule allows it, so "the same along the row" is not also "the same everywhere".
function rows3(r, k, row, distinctVals) {
  if (k === 'dist') {
    const vals = distinctVals();
    if (!vals) return null;
    const dir = r() < 0.5 ? 1 : 2;
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
    if (k === 'add') return a + b <= hi ? [a, b, a + b] : null;
    if (k === 'sub') return a - b >= lo ? [a, b, a - b] : null;
    const d = STEP[k];
    return a + 2 * d >= lo && a + 2 * d <= hi ? [a, a + d, a + 2 * d] : null;
  }, () => (hi - lo >= 2 ? shuffle(r, range(lo, hi)).slice(0, 3) : null));
}
function setValues(r, k, bits, lo, hi, perm) {
  const rand = () => { for (;;) { const m = int(r, 1, (1 << bits) - 1), n = pop(m); if (n >= lo && n <= hi) return m; } };
  return rows3(r, k, () => {
    const a = rand(), b = rand();
    if (k === 'const') return [a, a, a];
    if (k in TURNS) {
      const b2 = turn(a, perm, TURNS[k]), c2 = turn(b2, perm, TURNS[k]);
      return b2 !== a && c2 !== a && c2 !== b2 ? [a, b2, c2] : null;
    }
    let c;
    if (k === 'or') c = a | b;
    else if (k === 'and') c = a & b;
    else if (k === 'xor') { c = a ^ b; if (!(a & b)) return null; } // something must cancel, or it is just or
    else if (k === 'minus') { c = a & ~b; if (!(a & b)) return null; }
    return c && c !== a && c !== b ? [a, b, c] : null;
  }, () => { const s = new Set(); while (s.size < 3) s.add(rand()); return [...s]; });
}
function randomMask(r, bits, n) {
  return shuffle(r, range(0, bits - 1)).slice(0, n).reduce((m, i) => m | (1 << i), 0);
}

// Grids and figures: how many places or strokes a random set has.
const SET_SIZE = { 4: [1, 3], 8: [1, 3], 9: [2, 5], lines: [2, 4] };
// A rule down the columns is made as a rule along the rows and transposed.
const T9 = [0, 3, 6, 1, 4, 7, 2, 5, 8];
const transpose = (v) => T9.map((i) => v[i]);

// One component across the nine panels. plan: { attribute: rule } for the attributes that vary, the rest are const;
// dirs: { attribute: 'cols' } for the rules that run down the columns.
// Returns { vals: [9 component arrays], rules: [{ a, k, d? }] } or null.
function genComponent(r, spec, plan, dirs) {
  const rules = [];
  const orient = (a, k, v) => {
    const ru = { a, k };
    if (dirs[a] === 'cols') ru.d = 'cols';
    rules.push(ru);
    return v && ru.d ? transpose(v) : v;
  };
  const attr = (a, dom, lo = 0) => {
    const k = plan[a] || 'const';
    // Shapes in steps go triangle, square, pentagon, hexagon: one more corner each; the circle has none to count.
    return orient(a, k, numValues(r, k, lo, a === 't' && k !== 'const' && k !== 'dist' ? 3 : dom - 1 + lo));
  };
  if (spec.kind === 'lines') {
    const k = plan.l || 'const';
    const l = orient('l', k, setValues(r, k, spec.n, ...SET_SIZE.lines, spec.turn));
    return l && { vals: l.map((m) => [m]), rules };
  }
  if (spec.kind === 'shape') {
    const t = attr('t', spec.t), s = attr('s', spec.s), c = attr('c', spec.c);
    return t && s && c && { vals: t.map((_, i) => [t[i], s[i], c[i]]), rules };
  }
  let p;
  if (plan.n) {
    const n = orient('n', plan.n, numValues(r, plan.n, 1, spec.n));
    p = n && n.map((x) => randomMask(r, spec.n, x));
  } else {
    p = orient('p', plan.p || 'const', setValues(r, plan.p || 'const', spec.n, ...SET_SIZE[spec.n], spec.turn));
  }
  const t = attr('t', spec.t), s = attr('s', spec.s), c = attr('c', spec.c);
  return p && t && s && c && { vals: p.map((_, i) => [p[i], t[i], s[i], c[i]]), rules };
}

// How hard each rule is to see, for sorting levels within a tier.
const WEIGHT = { const: 0, dist: 1, up1: 1, down1: 1, up2: 1.4, down2: 1.4, add: 2, sub: 2.2, or: 1.3, and: 1.8, xor: 2.2, minus: 2.2, cw1: 2, ccw1: 2, cw2: 1.8 };
const BASE = { centre: 0, grid4: 0.5, lines: 0.5, grid9: 1, lr: 1.5, oi: 1.5, rc: 1.5 };
const COLS_WEIGHT = 0.6; // a rule that runs down the columns among rules along the rows

// opts: { seed, layout, vary (how many attributes follow a rule other than const), kinds: { type, num, n, p, l,
//   nShare (how often a grid's rule is about the count rather than the places; 0.5 by default) },
//   cols (the chance that a rule runs down the columns instead of along the rows; 0 by default) }
// Returns a level { layout, score, cells, options, answer, rules } or null when this seed gives nothing good.
function generateLevel({ seed, layout, vary, kinds, cols = 0 }) {
  const r = rng(seed), specs = LAYOUTS[layout];
  // The attributes that can vary: [component, attribute]; a grid's count and places are one choice ('np').
  const slots = [];
  specs.forEach((spec, ci) => {
    if (spec.kind === 'lines') slots.push([ci, 'l']);
    else for (const a of spec.kind === 'grid' ? ['np', 't', 's', 'c'] : ['t', 's', 'c']) if (a === 'np' || spec[a] > 1) slots.push([ci, a]);
  });
  // A grid always moves its places or its count: a grid that never changes is a poor puzzle.
  const must = slots.filter(([, a]) => a === 'l' || a === 'np');
  const rest = shuffle(r, slots.filter((s) => !must.includes(s)));
  const chosen = must.concat(rest).slice(0, Math.max(vary, must.length));
  const plans = specs.map(() => ({}));
  for (const [ci, a] of chosen) {
    if (a === 'np') {
      const mode = kinds.n && kinds.p ? (r() < (kinds.nShare ?? 0.5) ? 'n' : 'p') : kinds.n ? 'n' : 'p';
      plans[ci][mode] = pick(r, kinds[mode]);
    } else if (a === 'l') plans[ci].l = pick(r, kinds.l);
    else plans[ci][a] = pick(r, a === 't' ? kinds.type : kinds.num);
  }
  // A dist of sizes needs three sizes; the outer shape has one.
  const dirs = specs.map((spec) => {
    const d = {};
    for (const a of ATTRS[spec.kind]) if (cols && r() < cols) d[a] = 'cols';
    return d;
  });
  const comps = specs.map((spec, ci) => genComponent(r, spec, plans[ci], dirs[ci]));
  if (comps.some((c) => !c)) return null;
  const panels = range(0, 8).map((i) => comps.map((c) => c.vals[i]));
  const cells = panels.slice(0, 8), answer = panels[8];
  const rules = [];
  comps.forEach((c, ci) => c.rules.forEach((ru) => rules.push(Object.assign({ c: ci }, ru))));
  if (!accepts(layout, cells, answer)) return null;

  // ---------- The eight answers ----------
  // Splits: an attribute of the answer and a wrong value for it. Varying attributes first; a set attribute
  // (places, lines) can be split more than once, by flipping different places or strokes.
  const domain = (spec, a) => (a === 'n' ? range(1, spec.n) : range(0, spec[a] - 1));
  const cands = [];
  const varying = shuffle(r, rules.filter((ru) => ru.k !== 'const'));
  const fixed = shuffle(r, rules.filter((ru) => ru.k === 'const' && ru.a !== 'p' && ru.a !== 'l' && specs[ru.c][ru.a] > 1));
  for (const ru of varying.concat(fixed)) cands.push(ru);
  for (const ru of varying) if (CLASS[ru.a] === 'set') cands.push(ru, ru);
  const colOf = (ci, a) => panels.map((p) => get(specs[ci], p[ci], a));

  for (let tries = 0; tries < 40; tries++) {
    const used = new Set(), splits = [];
    for (const ru of cands) {
      if (splits.length === 3) break;
      const spec = specs[ru.c], key = ru.c + ru.a, x = get(spec, answer[ru.c], ru.a);
      if (CLASS[ru.a] === 'set' && !used.has(key) && r() < 0.6) {
        // The likeliest mistakes about a whole set: turned the wrong way or not at all, combined the wrong way,
        // or a neighbour copied. Comes before any flips on the same attribute, so the flips apply on top of it.
        const m = (i) => panels[i][ru.c][0];
        const alts = [m(7), m(5), m(6) | m(7), m(6) ^ m(7), m(6) & m(7), m(2) | m(5), m(2) ^ m(5), m(2) & m(5)];
        if (spec.turn) alts.push(turn(x, spec.turn, 1), turn(x, spec.turn, -1), turn(x, spec.turn, 2));
        const pool = alts.filter((y) => y && y !== x);
        if (pool.length) {
          used.add(key);
          splits.push({ c: ru.c, a: ru.a, set: pick(r, pool) });
          continue;
        }
      }
      if (CLASS[ru.a] === 'set') {
        // Flip a place or stroke; mostly one that is in play in the last row, which makes the likelier mistakes.
        used.add(key);
        const bits = spec.n;
        const row3 = panels[6][ru.c][0] | panels[7][ru.c][0];
        const pool = range(0, bits - 1).filter((b) => !used.has(key + ':' + b));
        if (!pool.length) continue;
        const near = pool.filter((b) => row3 >> b & 1);
        const b = near.length && r() < 0.75 ? pick(r, near) : pick(r, pool);
        used.add(key + ':' + b);
        splits.push({ c: ru.c, a: ru.a, flip: 1 << b });
      } else {
        if (used.has(key)) continue;
        used.add(key);
        // A wrong value, mostly one seen elsewhere in the matrix: a value from nowhere is too easy to rule out.
        const dom = domain(spec, ru.a).filter((y) => y !== x);
        const seen = dom.filter((y) => colOf(ru.c, ru.a).slice(0, 8).includes(y));
        const y = seen.length && r() < 0.8 ? pick(r, seen) : pick(r, dom);
        const s = { c: ru.c, a: ru.a, to: y };
        if (ru.a === 'n') s.mask = randomMask(r, spec.n, y);
        splits.push(s);
      }
    }
    if (splits.length < 3) return null;
    const options = range(0, 7).map((m) => {
      const o = answer.map((v) => v.slice());
      splits.forEach((s, j) => {
        if (!(m >> j & 1)) return;
        const v = o[s.c], spec = specs[s.c];
        if (s.flip) v[0] ^= s.flip;
        else if (s.set) v[0] = s.set;
        else if (s.a === 'n') v[0] = s.mask;
        else v[(spec.kind === 'shape' ? 'tsc' : 'ptsc').indexOf(s.a)] = s.to;
      });
      return o;
    });
    const keys = new Set(options.map((o) => JSON.stringify(o)));
    if (keys.size !== 8) continue;
    if (options.some((o) => o.some((v, ci) => specs[ci].kind !== 'shape' && !v[0]))) continue;
    if (options.slice(1).some((o) => accepts(layout, cells, o))) continue;
    // Shuffle the answers; the right one is options[0] before the shuffle.
    const order = shuffle(r, range(0, 7));
    const score = BASE[layout] + rules.reduce((t, ru) => t + WEIGHT[ru.k] + (ru.d && ru.k !== 'const' ? COLS_WEIGHT : 0), 0);
    return { layout, score: Math.round(score * 10) / 10, cells, options: order.map((i) => options[i]), answer: order.indexOf(0), rules };
  }
  return null;
}

// ---------- Sets of levels ----------
// Matrix Test: how many questions of each tier a test of 25 or 50 has, with the weight on hard.
const TEST_MIX = { 25: { 1: 3, 2: 5, 3: 9, 4: 8 }, 50: { 1: 6, 2: 10, 3: 18, 4: 16 } };
// The rules each tier draws from (a rule listed twice is drawn twice as often). type: shapes, num: sizes and shades,
// n: how many, p: which places, l: lines; nShare: how often a grid's rule is about the count rather than the places.
const KINDS = {
  1: { type: ['dist', 'up1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist'], p: ['dist'], l: ['or'] },
  2: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1'], n: ['up1', 'down1', 'dist', 'add'], p: ['dist', 'or', 'xor'], l: ['xor', 'and', 'or', 'dist'] },
  3: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist', 'up1'], p: ['xor', 'and', 'or', 'dist', 'minus'], l: ['xor', 'and', 'minus', 'cw1', 'ccw1', 'cw2'] },
  4: { type: ['dist', 'up1', 'down1'], num: ['dist', 'up1', 'down1', 'up2', 'down2'], n: ['add', 'sub', 'dist'], p: ['cw1', 'ccw1', 'cw1', 'ccw1', 'cw2', 'xor'], l: ['cw1', 'ccw1', 'cw2', 'xor', 'and'], nShare: 0.3 },
};
// The chance, per attribute, that its rule runs down the columns instead of along the rows.
const COLS_SHARE = { 1: 0, 2: 0, 3: 0, 4: 0.5 };
// [tier, layout, how many attributes vary]. A tier takes its levels from its recipes in turn.
const PLAN = [
  [1, 'centre', 1], [1, 'centre', 2], [1, 'grid4', 1], [1, 'grid9', 1], [1, 'lines', 1], [1, 'lr', 1], [1, 'oi', 1],
  [2, 'centre', 3], [2, 'grid4', 2], [2, 'grid9', 2], [2, 'lines', 1], [2, 'lr', 2], [2, 'oi', 2],
  [3, 'grid9', 3], [3, 'grid4', 3], [3, 'lr', 3], [3, 'lr', 4], [3, 'oi', 3], [3, 'oi', 4], [3, 'lines', 1], [3, 'centre', 3],
  [4, 'grid9', 3], [4, 'rc', 3], [4, 'rc', 4], [4, 'lines', 1], [4, 'oi', 4], [4, 'lr', 5],
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
    let recipes = PLAN.filter((p) => p[0] === tier).map(([, layout, vary], pi) => ({ layout, vary, seed: seed + tier * 100000 + pi * 10000, done: false, got: 0 }));
    if (shuffled) recipes = shuffle(r, recipes);
    while (batch.length < counts[tier]) {
      const live = recipes.filter((rc) => !rc.done);
      if (!live.length) throw new Error(`tier ${tier}: only ${batch.length} different patterns`);
      for (const rc of live) {
        if (batch.length === counts[tier]) break;
        let lv = null;
        for (let k = 0; k < tries && !lv; k++) {
          const got = generateLevel({ seed: rc.seed++, layout: rc.layout, vary: rc.vary, kinds: KINDS[tier], cols: COLS_SHARE[tier] });
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

module.exports = { LAYOUTS, ATTRS, CLASS, RULES, KINDS, TEST_MIX, get, pop, turn, holds, explain, accepts, generateLevel, signature, buildSet };
