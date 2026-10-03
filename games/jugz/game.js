// Jugz: the water-jug puzzle. Three jugs, the biggest one full; pour from one into another until the first is empty
// or the second is full, and measure out the amount asked for in any jug. Fewest pours for three stars.
// Runs inside the Puzzles shell (src/shell/shell.js); the vessels are drawn by vessels.js, the rules live in Engine.
const LEVELS = __LEVELS__;

// Skins: three vessels, one game. The colours are in game.css under body[data-skin]; the words are here.
// Nothing about the puzzle, the levels or the saved stars changes with the skin, so switching mid-level is safe.
// SKINS is the order the hidden switch walks.
const SKINS = ['water', 'wine', 'beer'];
const UNIT = { water: 'L', wine: 'U', beer: 'S' };      // S for Seidel
const VESSEL = { water: 'jug', wine: 'glass', beer: 'stein' };
const BRAND = { water: 'Jugz', wine: 'Winez', beer: 'Beerz' };
const ACCENT = { water: '#6FE7D4', wine: '#F0A8B8', beer: '#F5C242' };
const TIER_NAME = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

// The standalone Jugz saved { current, stars: { levelIndex: n }, skin } under "jugz_v1" on this same origin.
// Carry it over once, so a player keeps their stars, their place and their skin.
(function migrate() {
  const old = store.get('jugz_v1', null);
  if (!old || typeof old !== 'object' || store.get('jugz.migrated', false)) return;
  const solved = store.get('jugz.solved', {}), stars = store.get('jugz.stars', {});
  for (const [i, n] of Object.entries(old.stars || {})) {
    const id = +i + 1;
    if (!(n > 0) || !LEVELS[id - 1]) continue;
    if (!(id in solved)) solved[id] = null; // solved, but no time was ever measured
    stars[id] = Math.max(stars[id] || 0, n);
  }
  store.set('jugz.solved', solved); store.set('jugz.stars', stars);
  if (store.get('jugz.cur', null) == null && Number.isInteger(old.current)) store.set('jugz.cur', old.current);
  if (store.get('jugz.skin', null) == null && SKINS.includes(old.skin)) store.set('jugz.skin', old.skin);
  if (Object.keys(solved).length) store.set('jugz.rulesSeen', true);
  store.set('jugz.migrated', true);
})();

let skin = SKINS.includes(store.get('jugz.skin', 'water')) ? store.get('jugz.skin', 'water') : 'water';
let stars = store.get('jugz.stars', {});
let ctx, board, root, lv;
let caps = [], state = [], moves = 0, opt = 0, goal = 0, sel = -1, busy = false, hintPour = null;
const isSolved = (id) => id in store.get('jugz.solved', {});
const $j = (id) => document.getElementById(id);

// ---------- Drawing ----------
function build() {
  root.innerHTML = `<div class="jz-goal"><span class="g-text">Measure out exactly <b>${goal} ${UNIT[skin]}</b> in any ${VESSEL[skin]}</span>`
    + `<div class="jz-mark" aria-hidden="true"><b>${BRAND[skin]}</b><div class="droplet"></div></div></div>`
    + `<div class="shelf">${caps.map((cap, i) => `<div class="jug" id="jug${i}" data-i="${i}" role="button" tabindex="0">${vesselSVG(i, cap)}<div class="amt" id="amt${i}"></div></div>`).join('')}</div>`
    + '<div class="jz-wipe" hidden></div>';
  fit();
}

// The board is a square as wide as the stage. The vessels are scaled together to fill what the goal line and the
// amounts under them leave.
function fit() {
  const W = Math.floor(ctx.width());
  root.style.width = root.style.height = W + 'px';
  const svgs = [...root.querySelectorAll('.jug svg')];
  if (!svgs.length) return;
  const natW = svgs.reduce((t, s) => t + (+s.getAttribute('width')), 0) + 8 * (svgs.length - 1);
  const natH = Math.max(...svgs.map((s) => +s.getAttribute('height')));
  const band = root.querySelector('.jz-goal').offsetHeight;
  const amt = root.querySelector('.amt').offsetHeight || 17;
  const availW = W - 28, availH = W - band - 12 - (amt + 6) - 14;
  const sc = Math.max(0.2, Math.min(availW / natW, availH / natH, 1.9));
  svgs.forEach((s) => {
    s.style.width = (+s.getAttribute('width')) * sc + 'px';
    s.style.height = (+s.getAttribute('height')) * sc + 'px';
  });
}

// How wide the vessel is at height y, from the profile it published: 1 at its widest, as little as a tenth of that
// at the bottom of a wine glass.
function widthAt(svg, y) {
  const p = (svg.dataset.prof || '1').split(',').map(Number);
  if (p.length < 2) return p[0] || 1;
  const topY = +svg.dataset.top, botY = +svg.dataset.bot;
  const t = Math.max(0, Math.min(1, (y - topY) / (botY - topY))) * (p.length - 1);
  const k = Math.min(p.length - 2, Math.floor(t));
  return p[k] + (p[k + 1] - p[k]) * (t - k);
}

function render() {
  caps.forEach((cap, i) => {
    const svg = root.querySelector('#jug' + i + ' svg');
    const topY = +svg.dataset.top, botY = +svg.dataset.bot, usable = botY - topY;
    const h = (state[i] / cap) * usable, y = botY - h;
    // The liquid line is the middle of the surface ellipse, so the body of the liquid starts one half-ellipse lower:
    // the surface group fills the corners the near half of the arc leaves. The group is drawn at the vessel's widest
    // and scaled to the width it has here, which drags the sag along: a narrow bowl gets a shallow arc.
    const p = widthAt(svg, y), cx = +svg.dataset.cx || 0, sag = (+svg.dataset.ry || 0) * p;
    const w = $j('water' + i);
    w.setAttribute('y', y + sag);
    w.setAttribute('height', Math.max(0, botY - y - sag));
    const wr = $j('wrect' + i);
    wr.setAttribute('y', y); wr.setAttribute('height', h);
    // The body half of the etch clip; the curved half is the surface itself, so it takes the surface's transform.
    const er = $j('erect' + i);
    er.setAttribute('y', y); er.setAttribute('height', Math.max(0, botY - y));
    const sg = $j('surfg' + i), tf = 'translate(' + (cx * (1 - p)).toFixed(2) + 'px,' + y + 'px) scale(' + p.toFixed(3) + ')';
    sg.style.transform = tf;
    sg.style.opacity = state[i] > 0 ? 1 : 0;
    ['eell', 'efoam'].forEach((id) => { const el = $j(id + i); if (el) el.style.transform = tf; });
    const amt = $j('amt' + i);
    amt.textContent = state[i] + ' ' + UNIT[skin];
    // Gold once it is the amount asked for, the liquid's colour while there is liquid, grey at empty.
    amt.style.color = state[i] === goal ? 'var(--gold)' : state[i] > 0 ? 'var(--amount)' : 'var(--haze)';
    const j = $j('jug' + i);
    j.classList.toggle('sel', sel === i);
    j.classList.toggle('hintflash', !!hintPour && (hintPour.from === i || hintPour.to === i));
    j.setAttribute('aria-label', `${cap} ${UNIT[skin]} ${VESSEL[skin]}, holding ${state[i]}${sel === i ? ', picked up' : ''}`);
  });
}

// ---------- Playing ----------
function tap(i) {
  if (busy || ctx.finished) return;
  if (sel === -1) {
    if (state[i] === 0) { deny(i); return; }
    sel = i; ctx.refresh(); return;
  }
  if (sel === i) { sel = -1; ctx.refresh(); return; }
  const amt = Math.min(state[sel], caps[i] - state[i]);
  if (amt <= 0) { deny(i); return; }
  const from = sel, was = state[from]; // the legs need the level the glass was emptied from
  ctx.change(() => { state[from] -= amt; state[i] += amt; moves++; sel = -1; });
  busy = true;
  runLegs(from, was);
  runHead(i);
  setTimeout(() => { busy = false; }, 520); // the length of the CSS pour
}
function deny(i) {
  const j = $j('jug' + i);
  j.classList.remove('deny'); void j.offsetWidth; j.classList.add('deny');
}

// One run of the legs down the wall a pour just laid bare: from the level glass i was emptied from (was) to where it
// settled. LEG_SPEED keeps the trickle at one pace whatever the band is; a band under MIN_BAND is not worth a tear.
// Restarting needs the class to leave and come back with a forced reflow between; getBoundingClientRect, because
// legsg is an SVG <g> and has no offsetWidth.
const LEG_SPEED = 9, MIN_BAND = 12, LEG_MIN = 3.5, LEG_MAX = 11;
function runLegs(i, was) {
  if (skin !== 'wine') return;
  const lg = $j('legsg' + i);
  if (!lg) return;
  const svg = root.querySelector('#jug' + i + ' svg');
  const usable = (+svg.dataset.bot) - (+svg.dataset.top);
  const y = (a) => (+svg.dataset.bot) - (a / caps[i]) * usable;
  const band = y(state[i]) - y(was);
  lg.classList.remove('legs');
  if (band < MIN_BAND) return;
  // The group parks at the top of the new surface, not at the liquid line (the middle of the surface ellipse):
  // a tear on the inside of the glass is taken by the wine the moment it reaches it.
  const rest = y(state[i]) - (+svg.dataset.ry || 0) * widthAt(svg, y(state[i]));
  lg.style.transform = 'translateY(' + rest.toFixed(1) + 'px)';
  const s = Math.min(LEG_MAX, Math.max(LEG_MIN, band / LEG_SPEED));
  lg.querySelectorAll('.leg').forEach((l, k) => {
    l.style.setProperty('--ls', band.toFixed(1) + 'px');
    l.style.setProperty('--lg', (s * (1 + k * 0.14)).toFixed(2) + 's');
  });
  lg.getBoundingClientRect(); lg.classList.add('legs');
}
// The head of a stein that has just been filled stands high and settles: the mirror of the legs, on the stein poured
// INTO. Beer at rest does not re-foam, so it runs once per pour.
function runHead(i) {
  if (skin !== 'beer') return;
  const hg = $j('headg' + i);
  if (!hg) return;
  hg.classList.remove('surge'); hg.getBoundingClientRect(); hg.classList.add('surge');
}

function giveHint() {
  if (busy) return null;
  const path = Engine.solveFrom(caps, state, goal);
  if (!path || !path.length) return null;
  const m = path[0], V = VESSEL[skin], U = UNIT[skin];
  sel = -1; hintPour = m;
  return {
    label: 'Next pour',
    text: `Pour the ${caps[m.from]} ${U} ${V} into the ${caps[m.to]} ${U} ${V}`
      + (path.length === 1 ? ', and the goal is measured.' : ': the first pour on the shortest way from here.'),
  };
}

// ---------- The hidden skin switch ----------
// Three taps on the wordmark, each within TAP_GAP of the one before (a chain, not a fixed window, so a hesitant
// rhythm still gets there). From the second tap the droplet lights up: one stray tap does nothing, a repeat says
// "keep going". It listens on pointerdown, because iOS withholds click from an element without cursor:pointer.
function paintSkin() {
  document.body.dataset.skin = skin;
  if (document.body.dataset.game === 'jugz') document.body.style.setProperty('--accent', ACCENT[skin]);
}
function applySkin(next) {
  skin = next; store.set('jugz.skin', skin);
  paintSkin(); build(); ctx.refresh(); // the skins share element ids, not geometry
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let swapping = false;
function swapSkin() {
  if (swapping || busy) return false;
  const next = SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length];
  if (REDUCED) { applySkin(next); return true; }
  swapping = true;
  // A circle of the incoming backdrop grows out of the droplet, the skin changes underneath it, then it fades.
  const wipe = root.querySelector('.jz-wipe'), d = root.querySelector('.droplet').getBoundingClientRect(), r = root.getBoundingClientRect();
  wipe.style.setProperty('--ox', Math.round(100 * (d.left + d.width / 2 - r.left) / r.width) + '%');
  wipe.style.setProperty('--oy', Math.round(100 * (d.top + d.height / 2 - r.top) / r.height) + '%');
  wipe.className = 'jz-wipe to-' + next; wipe.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => wipe.classList.add('go')));
  setTimeout(() => {
    applySkin(next);
    // build() made a fresh wipe; carry the finished circle over and fade it out.
    const w2 = root.querySelector('.jz-wipe');
    w2.style.cssText = wipe.style.cssText; w2.className = 'jz-wipe to-' + next + ' go'; w2.hidden = false;
    requestAnimationFrame(() => w2.classList.add('fade'));
    setTimeout(() => { w2.hidden = true; w2.className = 'jz-wipe'; swapping = false; }, 460);
  }, 650);
  return true;
}
const TAP_GAP = 900;
let taps = 0, lastTap = -1e9;
function countTap() {
  if (swapping) return; // the wipe is running: further taps are impatience, not a second run
  const now = performance.now();
  taps = now - lastTap < TAP_GAP ? taps + 1 : 1;
  lastTap = now;
  if (taps >= 2) { const d = root.querySelector('.droplet'); d.classList.remove('ping'); void d.offsetWidth; d.classList.add('ping'); }
  // swapSkin refuses while a pour is animating; leave the run standing so the next tap completes it.
  if (taps >= 3 && swapSkin()) taps = 0;
}

function init(c) {
  ctx = c; board = c.board;
  board.innerHTML = '<div class="jz"></div>';
  root = board.firstChild;
  root.addEventListener('click', (e) => { const j = e.target.closest('.jug'); if (j) tap(+j.dataset.i); });
  root.addEventListener('keydown', (e) => { const j = e.target.closest('.jug'); if (j && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(+j.dataset.i); } });
  root.addEventListener('pointerdown', (e) => { if (e.target.closest('.jz-mark')) countTap(); });
  paintSkin();
}

// ---------- Rules ----------
// Flat jugs on the dusk backdrop: caps, contents, and optionally a picked-up jug (sel), a pour arrow (from, to),
// lit-up jugs (hint) and the goal amount (in gold when a jug holds it).
function flat(cs, st, o = {}) {
  const max = Math.max(...cs), W = 128, H = 96, base = 74, gap = 9;
  const ws = cs.map((c) => 20 + 16 * c / max), hs = cs.map((c) => 20 + 40 * c / max);
  let x = (W - ws.reduce((a, b) => a + b, 0) - gap * (cs.length - 1)) / 2;
  const mid = [];
  let h = `<svg class="mini" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || ''}"><rect width="${W}" height="${H}" style="fill:var(--indigo)"/>`;
  cs.forEach((c, i) => {
    const w = ws[i], hh = hs[i], y = base - hh, f = hh * st[i] / c;
    const lit = o.sel === i ? '#fff' : (o.hint || []).includes(i) ? 'var(--hint)' : 'var(--glass)';
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="4" style="fill:var(--tint)"/>`;
    if (f) h += `<rect x="${x + 1}" y="${base - f}" width="${w - 2}" height="${f}" rx="3" style="fill:var(--water-hi)"/>`;
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="4" fill="none" style="stroke:${lit}" stroke-width="${lit === 'var(--glass)' ? 1.4 : 2.2}"/>`;
    h += `<text x="${x + w / 2}" y="${base + 14}" text-anchor="middle" font-size="11" font-weight="700" style="fill:${st[i] === o.goal ? 'var(--gold)' : st[i] ? 'var(--amount)' : 'var(--haze)'};font-family:var(--display)">${st[i]}</text>`;
    h += `<text x="${x + w / 2}" y="${y + 11}" text-anchor="middle" font-size="8" style="fill:var(--etch);font-family:var(--display)">${c}</text>`;
    mid.push([x + w / 2, y]);
    x += w + gap;
  });
  if (o.from != null) {
    const [ax, ay] = mid[o.from], [bx, by] = mid[o.to], top = Math.min(ay, by) - 12;
    const dir = Math.sign(bx - ax);
    h += `<path d="M${ax} ${ay - 3}Q${(ax + bx) / 2} ${top - 8} ${bx} ${by - 3}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`
      + `<path d="M${bx - 4 * dir} ${by - 9}L${bx} ${by - 3}L${bx + 2 * dir} ${by - 10}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  }
  return h + '</svg>';
}
function rulesHtml() {
  const card = Rules.card;
  return [
    card('01', 'The goal', 'Measure out exactly the amount asked for, in any one jug. Every level starts with the biggest jug full and the others empty.',
      flat([8, 5, 3], [4, 1, 3], { goal: 4, label: 'Four litres in the big jug: solved' }), Rules.RIGHT),
    card('02', 'How to pour', 'Tap a jug to pick it up, then tap the jug to pour into. You pour until the first jug is empty or the second is full, whichever comes first.',
      flat([8, 5, 3], [8, 0, 0], { sel: 0, from: 0, to: 1, label: 'Pick up the big jug and pour it into the middle one' })),
    card('03', 'No marks on the jugs', 'A jug only knows full and empty. Every amount in between is made by pouring: 8 into 5 leaves 3 behind.',
      flat([8, 5, 3], [3, 5, 0], { label: 'Eight poured into five leaves three' })),
    card('04', 'Fewest pours', 'Three stars for the fewest pours possible, two for up to two more. The fewest possible shows once you have solved the level. Undo takes a pour back and does not count. Levels open one at a time: solve one to open the next.',
      `<svg class="mini" viewBox="0 0 128 96" role="img" aria-label="Three stars"><rect width="128" height="96" style="fill:var(--indigo)"/>${[30, 64, 98].map((cx) => `<path transform="translate(${cx} 48) scale(1.25)" d="M0-12l3.5 7.6 8.2.9-6.1 5.6 1.7 8.1L0 6.1l-7.3 4.1 1.7-8.1-6.1-5.6 8.2-.9z" style="fill:var(--accent)"/>`).join('')}</svg>`),
    card('05', 'Stuck? Tap Hint', 'Hint lights up the next pour on the shortest way from where you are.',
      flat([8, 5, 3], [3, 5, 0], { hint: [1, 2], from: 1, to: 2, label: 'Hint: pour the middle jug into the small one' })),
  ].join('');
}

Puzzles.register({
  id: 'jugz', name: 'Jugz', tagline: 'Three jugs, no marks: measure out exactly the amount asked for.',
  get accent() { return ACCENT[skin]; },
  logo: __LOGO__,
  levels: LEVELS,
  subtitle: (l) => TIER_NAME[Engine.tier(l.opt)],
  legend: '<span class="t1"><i></i>Easy</span><span class="t2"><i></i>Medium</span><span class="t3"><i></i>Hard</span>',
  levelClass: (l) => 't' + Engine.tier(l.opt),
  sections: () => [0, 50, 100].map((a) => ({ title: `Levels ${a + 1}–${a + 50}`, items: LEVELS.slice(a, a + 50) })),
  locked: (l) => l.id > 1 && !isSolved(l.id - 1),
  badge: (l) => '★'.repeat(stars[l.id] || 0),
  init,
  load(l) {
    lv = l; caps = l.caps.slice(); goal = l.goal; opt = l.opt;
    state = [caps[0], 0, 0]; moves = 0; sel = -1; busy = false; hintPour = null;
    build();
  },
  render,
  resize: fit,
  snapshot: () => ({ state: state.slice(), moves }),
  restore(s) { state = s.state.slice(); moves = s.moves; sel = -1; },
  reset() { state = [caps[0], 0, 0]; moves = 0; sel = -1; },
  started: () => moves > 0,
  solved: () => state.includes(goal),
  onSolved() {
    stars[lv.id] = Math.max(stars[lv.id] || 0, Engine.stars(moves, opt));
    store.set('jugz.stars', stars);
  },
  winNote() {
    const n = Engine.stars(moves, opt);
    return '★'.repeat(n) + '☆'.repeat(3 - n) + '  ' + (moves === opt ? `Perfect: the optimal ${opt} pours.` : `${moves} pours. The optimum is ${opt}.`);
  },
  status() {
    const V = VESSEL[skin];
    // The optimum shows only once the level has been solved: before that the length of the solution is a giveaway.
    return { count: `Pours <b>${moves}</b>${isSolved(lv.id) ? ' / ' + opt : ''}`, msg: sel === -1 ? `Tap a ${V} to pour from.` : `Now tap the ${V} to pour into.`, bad: false };
  },
  hint: giveHint,
  clearHint() { hintPour = null; },
  rulesHtml,
  // For the tests in test/.
  dbg: {
    get state() { return state; }, get moves() { return moves; }, get hint() { return hintPour; }, get lv() { return lv; },
    // One pour without the animation lock, as one undo step.
    pour(from, to) { const amt = Math.min(state[from], caps[to] - state[to]); ctx.change(() => { state[from] -= amt; state[to] += amt; moves++; sel = -1; }); },
  },
});
