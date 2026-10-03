'use strict';
// Queens: level generator, uniqueness check and a human-style logic solver (which rates the difficulty).
// Runs in Node (require) and in the browser (the build wraps it and exposes the exports).

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function popcount(x) {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}

// Step 1: a random valid placement (one per row and column, no two touching diagonally).
function randomQueens(n, rnd) {
  const cols = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  function rec(r) {
    if (r === n) return true;
    const order = shuffle([...Array(n).keys()], rnd);
    for (const c of order) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      used[c] = true; cols[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false; cols[r] = -1;
    }
    return false;
  }
  return rec(0) ? cols : null;
}

// Step 2: let each queen seed a region and grow the regions until the grid is full.
// alpha sets the balance: 0 = fully random, higher = more even region sizes.
function growRegions(n, queens, rnd, alpha) {
  const N = n * n;
  const grid = new Array(N).fill(-1);
  const size = new Array(n).fill(0);
  for (let r = 0; r < n; r++) { grid[r * n + queens[r]] = r; size[r] = 1; }
  let left = N - n;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (left > 0) {
    const opts = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < N; i++) {
      if (grid[i] !== -1) continue;
      const r = (i / n) | 0, c = i % n;
      for (const [dr, dc] of dirs) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const g = grid[rr * n + cc];
        if (g !== -1) opts[g].add(i);
      }
    }
    const w = new Array(n).fill(0);
    let total = 0, last = -1;
    for (let g = 0; g < n; g++) {
      if (opts[g].size) { w[g] = 1 / Math.pow(size[g], alpha); total += w[g]; last = g; }
    }
    let x = rnd() * total, pick = last;
    for (let g = 0; g < n; g++) {
      if (w[g] === 0) continue;
      x -= w[g];
      if (x <= 0) { pick = g; break; }
    }
    const cells = [...opts[pick]];
    const cell = cells[Math.floor(rnd() * cells.length)];
    grid[cell] = pick; size[pick]++; left--;
  }
  return { grid, size };
}

// Step 3: count solutions (stops at limit). A level is only valid with exactly one.
function countSolutions(n, grid, limit = 2) {
  let count = 0;
  const colUsed = new Array(n).fill(false);
  const regUsed = new Array(n).fill(false);
  function rec(r, prevC) {
    if (count >= limit) return;
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (colUsed[c] || Math.abs(c - prevC) <= 1) continue;
      const g = grid[r * n + c];
      if (regUsed[g]) continue;
      colUsed[c] = regUsed[g] = true;
      rec(r + 1, c);
      colUsed[c] = regUsed[g] = false;
    }
  }
  rec(0, -10);
  return count;
}

function combos(arr, k) {
  const out = [];
  (function rec(s, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}

// Human-style logic solver. Always uses the cheapest technique that makes progress.
//   Tier 1: a lone candidate in a region/row/column, and "k=1" (a region fits in one row/column, or the reverse)
//   Tier 2: k=2 (two regions share two rows/columns, or the reverse) and "look one step ahead"
//   Tier 3: k=3
// If the solver gets stuck the level needs guessing and is discarded.
function logicSolve(n, grid) {
  const N = n * n;
  const R = (i) => (i / n) | 0;
  const C = (i) => i % n;
  const st = {
    cand: new Uint8Array(N).fill(1),
    rowP: new Uint8Array(n), colP: new Uint8Array(n), regP: new Uint8Array(n),
  };
  const queens = [];
  const used = { single: 0, set1: 0, set2: 0, look: 0, set3: 0 };
  let tier = 0;

  function applyPlace(s, i) {
    const r = R(i), c = C(i), g = grid[i];
    for (let j = 0; j < N; j++) {
      const rj = R(j), cj = C(j);
      if (rj === r || cj === c || grid[j] === g || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) s.cand[j] = 0;
    }
    s.rowP[r] = 1; s.colP[c] = 1; s.regP[g] = 1;
  }

  function single() {
    for (let g = 0; g < n; g++) {
      if (st.regP[g]) continue;
      let cnt = 0, at = -1;
      for (let i = 0; i < N; i++) if (st.cand[i] && grid[i] === g) { cnt++; at = i; }
      if (cnt === 1) return at;
    }
    for (let r = 0; r < n; r++) {
      if (st.rowP[r]) continue;
      let cnt = 0, at = -1;
      for (let i = 0; i < N; i++) if (st.cand[i] && R(i) === r) { cnt++; at = i; }
      if (cnt === 1) return at;
    }
    for (let c = 0; c < n; c++) {
      if (st.colP[c]) continue;
      let cnt = 0, at = -1;
      for (let i = 0; i < N; i++) if (st.cand[i] && C(i) === c) { cnt++; at = i; }
      if (cnt === 1) return at;
    }
    return -1;
  }

  function setElim(k) {
    const regs = [], rows = [], cols = [];
    for (let x = 0; x < n; x++) {
      if (!st.regP[x]) regs.push(x);
      if (!st.rowP[x]) rows.push(x);
      if (!st.colP[x]) cols.push(x);
    }
    if (regs.length <= k) return false; // trivial when everything remains
    const rm = new Array(n).fill(0), cm = new Array(n).fill(0);
    const rr = new Array(n).fill(0), cc = new Array(n).fill(0);
    for (let i = 0; i < N; i++) {
      if (!st.cand[i]) continue;
      const g = grid[i];
      rm[g] |= 1 << R(i); cm[g] |= 1 << C(i);
      rr[R(i)] |= 1 << g; cc[C(i)] |= 1 << g;
    }
    let changed = false;
    for (const S of combos(regs, k)) {
      let rU = 0, cU = 0, sm = 0;
      for (const g of S) { rU |= rm[g]; cU |= cm[g]; sm |= 1 << g; }
      if (popcount(rU) === k) {
        for (let i = 0; i < N; i++) if (st.cand[i] && ((rU >> R(i)) & 1) && !((sm >> grid[i]) & 1)) { st.cand[i] = 0; changed = true; }
      }
      if (popcount(cU) === k) {
        for (let i = 0; i < N; i++) if (st.cand[i] && ((cU >> C(i)) & 1) && !((sm >> grid[i]) & 1)) { st.cand[i] = 0; changed = true; }
      }
    }
    for (const L of combos(rows, k)) {
      let gU = 0, lm = 0;
      for (const r of L) { gU |= rr[r]; lm |= 1 << r; }
      if (popcount(gU) === k) {
        for (let i = 0; i < N; i++) if (st.cand[i] && ((gU >> grid[i]) & 1) && !((lm >> R(i)) & 1)) { st.cand[i] = 0; changed = true; }
      }
    }
    for (const L of combos(cols, k)) {
      let gU = 0, lm = 0;
      for (const c of L) { gU |= cc[c]; lm |= 1 << c; }
      if (popcount(gU) === k) {
        for (let i = 0; i < N; i++) if (st.cand[i] && ((gU >> grid[i]) & 1) && !((lm >> C(i)) & 1)) { st.cand[i] = 0; changed = true; }
      }
    }
    return changed;
  }

  function deadEnd(s) {
    const gc = new Array(n).fill(0), rc = new Array(n).fill(0), cc = new Array(n).fill(0);
    for (let i = 0; i < N; i++) if (s.cand[i]) { gc[grid[i]]++; rc[R(i)]++; cc[C(i)]++; }
    for (let x = 0; x < n; x++) {
      if ((!s.regP[x] && gc[x] === 0) || (!s.rowP[x] && rc[x] === 0) || (!s.colP[x] && cc[x] === 0)) return true;
    }
    return false;
  }

  // "If a queen went here, would some region/row/column be left empty?" Then the cell can be eliminated.
  function lookahead() {
    let changed = false;
    for (let i = 0; i < N; i++) {
      if (!st.cand[i]) continue;
      const s = { cand: Uint8Array.from(st.cand), rowP: st.rowP.slice(), colP: st.colP.slice(), regP: st.regP.slice() };
      applyPlace(s, i);
      if (deadEnd(s)) { st.cand[i] = 0; changed = true; }
    }
    return changed;
  }

  let guard = 0;
  while (queens.length < n && guard++ < 1000) {
    const at = single();
    if (at >= 0) { applyPlace(st, at); queens.push(at); used.single++; tier = Math.max(tier, 1); continue; }
    if (setElim(1)) { used.set1++; tier = Math.max(tier, 1); continue; }
    if (setElim(2)) { used.set2++; tier = Math.max(tier, 2); continue; }
    if (lookahead()) { used.look++; tier = Math.max(tier, 2); continue; }
    if (setElim(3)) { used.set3++; tier = Math.max(tier, 3); continue; }
    break; // stuck: needs guessing
  }
  const solved = queens.length === n;
  const score = used.single + used.set1 * 2 + used.set2 * 5 + used.look * 6 + used.set3 * 10;
  return { solved, tier, used, score, queens };
}

// Repair: move border cells between regions (queens stay put, regions stay connected)
// until the number of solutions drops to exactly 1. Hill climbing on the solution count.
function refine(n, grid, queens, rnd, maxSteps, cap) {
  const N = n * n;
  const isSeed = new Uint8Array(N);
  for (let r = 0; r < n; r++) isSeed[r * n + queens[r]] = 1;
  const nb = (i) => {
    const r = (i / n) | 0, c = i % n, o = [];
    if (r > 0) o.push(i - n);
    if (r < n - 1) o.push(i + n);
    if (c > 0) o.push(i - 1);
    if (c < n - 1) o.push(i + 1);
    return o;
  };
  function connectedWithout(g, cell) {
    let start = -1, total = 0;
    for (let i = 0; i < N; i++) if (grid[i] === g && i !== cell) { total++; if (start < 0) start = i; }
    if (total === 0) return false;
    const seen = new Uint8Array(N); const st = [start]; seen[start] = 1; let k = 1;
    while (st.length) {
      const x = st.pop();
      for (const y of nb(x)) if (!seen[y] && y !== cell && grid[y] === g) { seen[y] = 1; k++; st.push(y); }
    }
    return k === total;
  }
  let cur = countSolutions(n, grid, cap);
  for (let step = 0; step < maxSteps && cur > 1; step++) {
    const cell = Math.floor(rnd() * N);
    if (isSeed[cell]) continue;
    const g = grid[cell];
    const others = [...new Set(nb(cell).map((j) => grid[j]).filter((x) => x !== g))];
    if (!others.length) continue;
    if (!connectedWithout(g, cell)) continue;
    const ng = others[Math.floor(rnd() * others.length)];
    grid[cell] = ng;
    const cnt = countSolutions(n, grid, cap);
    if (cnt <= cur) cur = cnt; else grid[cell] = g;
  }
  return cur;
}

function generateLevel(opts) {
  const { n, tier, seed, minRegion = 2, maxRegionFrac = 0.35, alpha = 1.0, maxAttempts = 2000, steps = 600, cap = 64 } = opts;
  const maxRegion = Math.floor(n * n * maxRegionFrac);
  const rnd = mulberry32(seed);
  for (let a = 1; a <= maxAttempts; a++) {
    const q = randomQueens(n, rnd);
    if (!q) continue;
    const { grid } = growRegions(n, q, rnd, alpha);
    if (refine(n, grid, q, rnd, steps, cap) !== 1) continue;
    const size = new Array(n).fill(0);
    for (const g of grid) size[g]++;
    if (Math.min(...size) < minRegion || Math.max(...size) > maxRegion) continue;
    const res = logicSolve(n, grid);
    if (!res.solved || (tier != null && res.tier !== tier)) continue;
    return { n, grid, solution: q, tier: res.tier, score: res.score, used: res.used, attempts: a };
  }
  return null;
}

const api = { mulberry32, randomQueens, growRegions, countSolutions, logicSolve, refine, generateLevel };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.QueensGen = api;
