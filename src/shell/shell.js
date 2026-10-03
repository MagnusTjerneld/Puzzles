'use strict';
// The Puzzles shell: the hub, routing (#queens, #tango, ...) and everything around a game: header, clock and best time,
// level picker, rules sheet, status row, hint text, undo/redo, restart and saved progress.
//
// A game registers itself with Puzzles.register(game). The shell gives it its own board element inside the square
// stage and a ctx (see makeCtx). The game owns its state and drawing; the shell owns everything else.
//
// A game object:
//   id, name, tagline, accent, logo (svg markup for the hub card), levels (each with a numeric id)
//   subtitle(level)              small line under "Level N", e.g. "6 × 6 · Easy"
//   sections()                   [{ title, items: [level] }] for the level picker; legend (html) and levelClass(level) optional
//   init(ctx)                    once, before the first level: attach listeners to ctx.board
//   load(level)                  build the board for a level in its start state
//   render()                     draw the current state (called after every change)
//   resize()                     the stage changed size
//   snapshot() / restore(s)      opaque copies of the state, for undo and redo
//   reset()                      back to the start state
//   started()                    has the player changed anything? (starts the clock)
//   solved()
//   status()                     { count: html, msg: text, bad: bool } for the status row while playing
//   hint()                       sets the game's own highlight and returns { text }, or null
//   clearHint()
//   rulesHtml()
//
// Progress is stored per game under "<id>.solved" ({ levelId: best seconds }), "<id>.cur" (level index)
// and "<id>.rulesSeen", the same keys the standalone games used, so progress carried over when they moved in.

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

const Puzzles = (() => {
  const games = [], byId = {};
  let game = null;          // the game on screen (or last on screen, while the hub shows)
  let solvedMap = {}, idx = 0, lv = null;
  let undoSt = [], redoSt = [], secs = 0, finished = false, hintText = '';
  let fromHub = false;      // this game was entered from a hub card, so the home button can go back in history
  let cardClicked = false;  // set by a card, read by the hash change it causes

  const key = (k) => game.id + '.' + k;

  function register(g) { games.push(g); byId[g.id] = g; }

  function makeCtx(g) {
    const board = document.createElement('div');
    board.className = 'board'; board.dataset.for = g.id; board.hidden = true;
    board.setAttribute('role', 'grid'); board.setAttribute('aria-label', g.name + ' board');
    $('stage').insertBefore(board, $('picker'));
    return {
      board,
      // Width available for the board, in CSS pixels.
      width: () => Math.min($('stage').clientWidth, 560),
      // Change the state through fn, as one undo step.
      change(fn) { const s = g.snapshot(); fn(); commit(s); },
      // The state has already changed in place (a drag); s is the snapshot from before it.
      record(s) { commit(s); },
      // Repaint without an undo step (during a drag, or when the game's own display changes).
      refresh: () => update(),
      get finished() { return finished; },
    };
  }

  function commit(s) { undoSt.push(s); redoSt = []; clearHint(); update(); }
  function clearHint() { hintText = ''; game.clearHint(); }

  function update() {
    game.render();
    const ex = $('explain');
    ex.hidden = !hintText;
    ex.innerHTML = hintText ? '<b>Why</b>' : '';
    if (hintText) ex.appendChild(document.createTextNode(hintText));
    finished = game.solved();
    game.ctx.board.classList.toggle('done', finished);
    const st = $('status');
    if (finished) {
      const best = solvedMap[lv.id];
      if (best == null || secs < best) { solvedMap[lv.id] = secs; store.set(key('solved'), solvedMap); showBest(); }
      const last = idx === game.levels.length - 1;
      store.set(key('cur'), last ? idx : idx + 1); // next time the game opens on the next level
      st.innerHTML = `<div class="win"><strong>Solved in ${fmt(secs)}</strong>${last ? '' : '<button class="go" id="next" type="button">Next level</button>'}</div>`;
      const nx = $('next'); if (nx) nx.onclick = () => load(idx + 1);
    } else {
      const s = game.status();
      st.innerHTML = `<span class="count">${s.count}</span><span class="msg${s.bad ? ' bad' : ''}" id="msg"></span>`;
      $('msg').textContent = s.msg;
    }
    $('undo').disabled = !undoSt.length; $('redo').disabled = !redoSt.length;
    $('hint').disabled = finished;
  }

  function showBest() { $('best').textContent = solvedMap[lv.id] != null ? 'Best ' + fmt(solvedMap[lv.id]) : ''; }

  function setHeader() {
    $('title').firstChild.nodeValue = 'Level ' + lv.id;
    $('sub').textContent = game.subtitle(lv);
    showBest();
    $('timer').textContent = fmt(secs);
  }

  function load(i) {
    idx = i; lv = game.levels[i];
    undoSt = []; redoSt = []; secs = 0; hintText = '';
    store.set(key('cur'), i);
    game.load(lv);
    setHeader(); update(); closePicker();
  }

  // ---------- Entering and leaving a game ----------
  function enter(id) {
    const g = byId[id];
    if (game !== g) {
      if (game) leave();
      game = g;
      document.body.dataset.game = g.id;
      document.body.style.setProperty('--accent', g.accent);
      if (!g.ctx) { g.ctx = makeCtx(g); g.init(g.ctx); }
      g.ctx.board.hidden = false;
      $('rulesSub').textContent = 'How to play ' + g.name;
      $('rulesBody').innerHTML = '';
      solvedMap = store.get(key('solved'), {});
      if (g.session) {
        // Back to a game left during this visit: pick up where it was, mid-level included.
        ({ idx, undoSt, redoSt, secs } = g.session);
        lv = g.levels[idx]; hintText = '';
        g.clearHint(); g.resize(); setHeader(); update();
      } else {
        load(Math.min(Math.max(store.get(key('cur'), 0), 0), g.levels.length - 1));
      }
    }
    document.title = g.name + ' · Puzzles';
    hideHub();
    if (!store.get(key('rulesSeen'), false) && !Object.keys(solvedMap).length) openRules();
  }

  function leave() {
    game.session = { idx, undoSt, redoSt, secs };
    game.ctx.board.hidden = true;
    closePicker(); closeRules(false);
  }

  // ---------- Hub ----------
  function renderCards() {
    const box = $('cards'); box.innerHTML = '';
    for (const g of games) {
      const done = Object.keys(store.get(g.id + '.solved', {})).length;
      const cur = Math.min(Math.max(store.get(g.id + '.cur', 0), 0), g.levels.length - 1);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.style.setProperty('--accent', g.accent);
      b.innerHTML = g.logo + `<span class="cname"></span><span class="ctag"></span><span class="cprog"></span><span class="cgo"></span>`;
      b.querySelector('.cname').textContent = g.name;
      b.querySelector('.ctag').textContent = g.tagline;
      b.querySelector('.cprog').textContent = `${done} of ${g.levels.length} solved`;
      b.querySelector('.cgo').textContent = done || cur ? 'Continue · Level ' + g.levels[cur].id : 'Play';
      b.onclick = () => { cardClicked = true; location.hash = g.id; };
      box.appendChild(b);
    }
  }
  function showHub() {
    if (game) { closePicker(); closeRules(false); }
    renderCards();
    const h = $('hub');
    h.hidden = false; h.classList.remove('out'); h.removeAttribute('aria-hidden');
    document.title = 'Puzzles';
  }
  function hideHub() {
    const h = $('hub');
    if (h.hidden) return;
    h.classList.add('out'); h.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (h.classList.contains('out')) h.hidden = true; }, 260);
  }
  const hubShowing = () => !$('hub').classList.contains('out') && !$('hub').hidden;

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    fromHub = cardClicked; cardClicked = false;
    if (byId[id]) enter(id); else showHub();
  }
  $('homeBtn').onclick = () => {
    if (fromHub) { history.back(); return; }
    history.replaceState(null, '', location.pathname + location.search);
    route();
  };

  // ---------- Buttons ----------
  $('undo').onclick = () => { if (!undoSt.length) return; redoSt.push(game.snapshot()); game.restore(undoSt.pop()); clearHint(); update(); };
  $('redo').onclick = () => { if (!redoSt.length) return; undoSt.push(game.snapshot()); game.restore(redoSt.pop()); clearHint(); update(); };
  $('reset').onclick = () => {
    if (game.started()) { const s = game.snapshot(); game.reset(); commit(s); }
    secs = 0; $('timer').textContent = fmt(0);
  };
  $('hint').onclick = () => {
    clearHint();
    const h = game.hint();
    hintText = h ? h.text : '';
    update();
  };
  window.addEventListener('resize', () => { if (game && lv) game.resize(); });

  // ---------- Level picker ----------
  function openPicker() {
    const p = $('picker'); p.innerHTML = '';
    if (game.legend) { const lg = document.createElement('div'); lg.className = 'legend'; lg.innerHTML = game.legend; p.appendChild(lg); }
    for (const sec of game.sections()) {
      const el = document.createElement('section');
      const done = sec.items.filter((l) => solvedMap[l.id] != null).length;
      el.innerHTML = `<h2>${sec.title} · ${done} of ${sec.items.length} solved</h2>`;
      const grid = document.createElement('div'); grid.className = 'lv';
      for (const l of sec.items) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = l.id;
        if (game.levelClass) b.className = game.levelClass(l);
        if (solvedMap[l.id] != null) b.classList.add('solved');
        if (l.id === lv.id) b.classList.add('now');
        b.onclick = () => load(game.levels.indexOf(l));
        grid.appendChild(b);
      }
      el.appendChild(grid); p.appendChild(el);
    }
    p.hidden = false; setMenuBtn(true);
    const now = p.querySelector('.now'); if (now) now.scrollIntoView({ block: 'nearest' });
  }
  function closePicker() { $('picker').hidden = true; setMenuBtn(false); }
  // A grid of levels when closed, a cross when open.
  const GRID_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="currentColor"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function setMenuBtn(open) {
    const b = $('menuBtn');
    b.innerHTML = open ? CLOSE_ICON : GRID_ICON;
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', open ? 'Close levels' : 'Levels'); b.title = b.getAttribute('aria-label');
  }
  setMenuBtn(false);
  $('menuBtn').onclick = () => ($('picker').hidden ? openPicker() : closePicker());

  // ---------- Rules ----------
  function openRules() {
    const r = $('rules'), body = $('rulesBody');
    if (!body.firstChild) body.innerHTML = game.rulesHtml();
    closePicker();
    r.hidden = false; r.scrollTop = 0; $('rulesClose').focus();
  }
  function closeRules(focus = true) {
    if ($('rules').hidden) return;
    $('rules').hidden = true; store.set(key('rulesSeen'), true);
    if (focus) $('rulesBtn').focus();
  }
  $('rulesBtn').onclick = openRules;
  $('rulesClose').onclick = () => closeRules();
  $('rulesPlay').onclick = () => closeRules();
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !game) return;
    if (!$('rules').hidden) closeRules(); else if (!$('picker').hidden) closePicker();
  });

  // The clock runs while a level is being played and nothing covers it. It starts at the first move.
  setInterval(() => {
    if (!game || finished || document.hidden || hubShowing() || !$('picker').hidden || !$('rules').hidden) return;
    if (!game.started()) return;
    secs++; $('timer').textContent = fmt(secs);
  }, 1000);

  function start() {
    addEventListener('hashchange', route);
    // Opened straight into a game (a shortcut or a shared link): skip the hub's fade.
    if (byId[decodeURIComponent(location.hash.slice(1))]) $('hub').hidden = true;
    route();
    // Offline support. Service workers need http(s), so this is skipped when the file is opened from disk.
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
    }
  }

  // For the tests in test/: drive the shell the way a player would, without going through the hub.
  const debug = {
    enter, load,
    change: (fn) => game.ctx.change(fn),
    get finished() { return finished; },
    get game() { return game; },
    get hintText() { return hintText; },
  };

  return { register, start, debug };
})();
