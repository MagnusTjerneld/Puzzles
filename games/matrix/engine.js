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
const LAYOUTS = {
  centre: [{ kind: 'shape', slot: 'c', t: 5, s: 5, c: 5 }],
  lr: [{ kind: 'shape', slot: 'l', t: 5, s: 4, c: 5 }, { kind: 'shape', slot: 'r', t: 5, s: 4, c: 5 }],
  oi: [{ kind: 'shape', slot: 'o', t: 5, s: 1, c: 3 }, { kind: 'shape', slot: 'i', t: 5, s: 4, c: 5 }],
  grid4: [{ kind: 'grid', n: 4, t: 5, s: 3, c: 5 }],
  grid9: [{ kind: 'grid', n: 9, t: 5, s: 3, c: 5 }],
  lines: [{ kind: 'lines', n: 9 }],
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
// two; dist puts the same three values in every row, in a new order; or, and, xor and minus combine two sets.
const RULES = {
  num: ['const', 'up1', 'down1', 'up2', 'down2', 'add', 'sub', 'dist'],
  type: ['const', 'up1', 'down1', 'up2', 'down2', 'dist'],
  set: ['const', 'dist', 'or', 'and', 'xor', 'minus'],
};
const STEP = { up1: 1, down1: -1, up2: 2, down2: -2 };

function tripleOk(k, a, b, c) {
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
function holds(k, lines) {
  if (k === 'dist') {
    const key = (t) => t.slice().sort((x, y) => x - y).join(',');
    return lines.every((t) => new Set(t).size === 3 && key(t) === key(lines[0]));
  }
  return lines.every((t) => tripleOk(k, t[0], t[1], t[2]));
}
const ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
const COLS = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
const take = (v, ls) => ls.map((l) => l.map((i) => v[i]));

// The rule that explains nine values along the rows or down the columns, or null.
function explain(cls, v) {
  for (const k of RULES[cls]) {
    if (holds(k, take(v, ROWS))) return { k, dir: 'rows' };
    if (holds(k, take(v, COLS))) return { k, dir: 'cols' };
  }
  return null;
}
// An attribute is free when no rule holds on the two complete rows, nor on the two complete columns: nothing in the
// matrix pins it down (where the shapes sit in a grid whose rule is about how many there are, for instance).
function free(cls, v) {
  return !RULES[cls].some((k) => holds(k, take(v, ROWS.slice(0, 2))) || holds(k, take(v, COLS.slice(0, 2))));
}
// cells: the eight panels shown; option: a ninth. True when every attribute is free or explained by a rule.
function accepts(layout, cells, option) {
  return LAYOUTS[layout].every((spec, ci) => ATTRS[spec.kind].every((a) => {
    const v = cells.map((p) => get(spec, p[ci], a));
    v.push(get(spec, option[ci], a));
    return free(CLASS[a], v) || !!explain(CLASS[a], v);
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
function setValues(r, k, bits, lo, hi) {
  const rand = () => { for (;;) { const m = int(r, 1, (1 << bits) - 1), n = pop(m); if (n >= lo && n <= hi) return m; } };
  return rows3(r, k, () => {
    const a = rand(), b = rand();
    if (k === 'const') return [a, a, a];
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
const SET_SIZE = { 4: [1, 3], 9: [2, 5], lines: [2, 4] };

// One component across the nine panels. plan: { attribute: rule } for the attributes that vary, the rest are const.
// Returns { vals: [9 component arrays], rules: [{ a, k }] } or null.
function genComponent(r, spec, plan) {
  const rules = [];
  const attr = (a, dom, lo = 0) => {
    const k = plan[a] || 'const';
    rules.push({ a, k });
    // Shapes in steps go triangle, square, pentagon, hexagon: one more corner each; the circle has none to count.
    return numValues(r, k, lo, a === 't' && k !== 'const' && k !== 'dist' ? 3 : dom - 1 + lo);
  };
  if (spec.kind === 'lines') {
    const k = plan.l || 'const';
    rules.push({ a: 'l', k });
    const l = setValues(r, k, spec.n, ...SET_SIZE.lines);
    return l && { vals: l.map((m) => [m]), rules };
  }
  if (spec.kind === 'shape') {
    const t = attr('t', spec.t), s = attr('s', spec.s), c = attr('c', spec.c);
    return t && s && c && { vals: t.map((_, i) => [t[i], s[i], c[i]]), rules };
  }
  let p;
  if (plan.n) {
    rules.push({ a: 'n', k: plan.n });
    const n = numValues(r, plan.n, 1, spec.n);
    p = n && n.map((x) => randomMask(r, spec.n, x));
  } else {
    rules.push({ a: 'p', k: plan.p || 'const' });
    p = setValues(r, plan.p || 'const', spec.n, ...SET_SIZE[spec.n]);
  }
  const t = attr('t', spec.t), s = attr('s', spec.s), c = attr('c', spec.c);
  return p && t && s && c && { vals: p.map((_, i) => [p[i], t[i], s[i], c[i]]), rules };
}

// How hard each rule is to see, for sorting levels within a tier.
const WEIGHT = { const: 0, dist: 1, up1: 1, down1: 1, up2: 1.4, down2: 1.4, add: 2, sub: 2.2, or: 1.3, and: 1.8, xor: 2.2, minus: 2.2 };
const BASE = { centre: 0, grid4: 0.5, lines: 0.5, grid9: 1, lr: 1.5, oi: 1.5 };

// opts: { seed, layout, vary (how many attributes follow a rule other than const), kinds: { type, num, n, p, l } }
// Returns a level { layout, score, cells, options, answer, rules } or null when this seed gives nothing good.
function generateLevel({ seed, layout, vary, kinds }) {
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
      const mode = kinds.n && kinds.p ? (r() < 0.5 ? 'n' : 'p') : kinds.n ? 'n' : 'p';
      plans[ci][mode] = pick(r, kinds[mode]);
    } else if (a === 'l') plans[ci].l = pick(r, kinds.l);
    else plans[ci][a] = pick(r, a === 't' ? kinds.type : kinds.num);
  }
  // A dist of sizes needs three sizes; the outer shape has one.
  const comps = specs.map((spec, ci) => genComponent(r, spec, plans[ci]));
  if (comps.some((c) => !c)) return null;
  const panels = range(0, 8).map((i) => comps.map((c) => c.vals[i]));
  const cells = panels.slice(0, 8), answer = panels[8];
  const rules = [];
  comps.forEach((c, ci) => c.rules.forEach((ru) => rules.push({ c: ci, a: ru.a, k: ru.k })));
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
      if (CLASS[ru.a] === 'set') {
        // Flip a place or stroke; mostly one that is in play in the last row, which makes the likelier mistakes.
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
    const score = BASE[layout] + rules.reduce((t, ru) => t + WEIGHT[ru.k], 0);
    return { layout, score: Math.round(score * 10) / 10, cells, options: order.map((i) => options[i]), answer: order.indexOf(0), rules };
  }
  return null;
}

module.exports = { LAYOUTS, ATTRS, CLASS, RULES, get, pop, holds, explain, accepts, generateLevel };
