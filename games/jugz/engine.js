'use strict';
// Jugz: the water-jug puzzle. Three jugs, the biggest full; pour until the source is empty or the target is full,
// and measure out an exact amount in any jug. This file holds the rules and the solver, shared by the game
// (Hint follows solveFrom) and the generator. Runs in Node (require) and in the browser (the build wraps it).

const key = (s) => s.join(',');

// Every pour from a state: from jug i into jug j until i is empty or j is full.
function pours(caps, s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === 0) continue;
    for (let j = 0; j < s.length; j++) {
      if (i === j) continue;
      const amt = Math.min(s[i], caps[j] - s[j]);
      if (amt <= 0) continue;
      const n = s.slice(); n[i] -= amt; n[j] += amt;
      out.push({ from: i, to: j, state: n });
    }
  }
  return out;
}

// Breadth-first distances from start to every reachable state.
function bfs(caps, start) {
  const dist = new Map(); dist.set(key(start), 0);
  let q = [start];
  while (q.length) {
    const nq = [];
    for (const s of q) {
      const d = dist.get(key(s));
      for (const p of pours(caps, s)) {
        const k = key(p.state);
        if (!dist.has(k)) { dist.set(k, d + 1); nq.push(p.state); }
      }
    }
    q = nq;
  }
  return dist;
}

// The shortest list of pours ({ from, to }) from state to any jug holding goal, [] if one already does, null if impossible.
function solveFrom(caps, state, goal) {
  if (state.includes(goal)) return [];
  const dist = new Map(); dist.set(key(state), 0);
  const via = new Map();
  let q = [state];
  while (q.length) {
    const nq = [];
    for (const s of q) {
      for (const p of pours(caps, s)) {
        const k = key(p.state);
        if (dist.has(k)) continue;
        dist.set(k, dist.get(key(s)) + 1);
        via.set(k, { move: { from: p.from, to: p.to }, pk: key(s) });
        if (p.state.includes(goal)) {
          const path = []; let cur = k;
          while (via.has(cur)) { const v = via.get(cur); path.unshift(v.move); cur = v.pk; }
          return path;
        }
        nq.push(p.state);
      }
    }
    q = nq;
  }
  return null;
}

// Stars for a solve: 3 at the optimum, 2 within two pours of it, else 1.
const stars = (moves, opt) => (moves <= opt ? 3 : moves <= opt + 2 ? 2 : 1);

// Difficulty by the optimal number of pours.
const tier = (opt) => (opt <= 4 ? 1 : opt <= 7 ? 2 : 3);

const api = { key, pours, bfs, solveFrom, stars, tier };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
