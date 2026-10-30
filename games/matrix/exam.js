// Matrix Test: a timed test in the style of a matrix admission test. 25 questions in 20 minutes or 50 in 40, drawn
// fresh for every test from the same recipes as the Matrix levels (Engine.buildSet), easy to hard and mostly hard.
// Nothing shows right or wrong until the test is handed in (or the time runs out); then every question can be gone
// through with the right answer and its rules in words. The score is the number right. It is deliberately not an
// IQ: that needs questions normed on a large group of people, and these never were.
// Registered by game.js after Matrix (registerExam), so the hub shows it after Matrix. Uses draw.js.

// id is the number of questions; mix is how many of each tier (Engine.TEST_MIX).
const FORMATS = [
  { id: 25, n: 25, mins: 20, mix: Engine.TEST_MIX[25] },
  { id: 50, n: 50, mins: 40, mix: Engine.TEST_MIX[50] },
];
const EXAM_LOGO = `<svg viewBox="108 108 296 296" aria-hidden="true">
  <g transform="translate(116 116)">
    <rect class="sq" width="280" height="280" fill="#1d1f24"/>
    <g class="pop">${[0, 1, 2].map((r) => [0, 1, 2].map((c) => (r === 2 && c === 2 ? '' : `<rect x="${10 + c * 90}" y="${10 + r * 90}" width="80" height="80" rx="6" fill="#f3f0e7"/>`)).join('')).join('')}</g>
    <g class="pop pop2"><circle cx="230" cy="236" r="40" fill="#2a2c33" stroke="#ff9a76" stroke-width="7"/><path d="M230 236V212M230 236l15 10" stroke="#ff9a76" stroke-width="7" stroke-linecap="round"/><path d="M220 186h20" stroke="#ff9a76" stroke-width="7" stroke-linecap="round"/></g>
    <g class="frame"><rect width="280" height="280" fill="none" stroke="#c8ccc4" stroke-width="8"/></g>
  </g>
</svg>`;

function registerExam() {
  // phase: 0 before the start, 1 under way, 2 handed in. ans[i]: the answer chosen for question i, or -1.
  // q: the question on screen. seed: the questions are Engine.buildSet of this seed, so a saved test comes back.
  let ctx, root, fm, seed, qs, ans, q, phase, confirm = false, shownKey = '', advance = null;
  let history = store.get('mtest.history', []);

  function questions(sd) {
    // A tier can run out of fresh patterns for one seed (very rarely); the next seed will do.
    for (let k = 0; ; k++) {
      try { return Engine.buildSet(fm.mix, { seed: sd + k * 7919, cap: 2, shuffled: true }).levels; } catch (e) { if (k > 20) throw e; }
    }
  }
  const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] % 1e9) + 1;
  const right = () => qs.reduce((t, l, i) => t + (ans[i] === l.answer), 0);
  const answered = () => ans.filter((a) => a >= 0).length;
  const bestOf = (n) => history.filter((h) => h.n === n).reduce((b, h) => Math.max(b, h.right), -1);

  function render() {
    const key = phase === 0 ? 'intro' : 'q' + q;
    if (key !== shownKey) {
      shownKey = key;
      root.innerHTML = phase === 0
        ? `<div class="mt-intro"><b>${fm.n} questions · ${fm.mins} minutes</b>
            <p>From easy to hard, and most of them hard: ${fm.mix[1]} easy, ${fm.mix[2]} medium, ${fm.mix[3]} hard and ${fm.mix[4]} expert.</p>
            <p>Tap an answer to choose it. You can change it, skip a question and come back. Right and wrong show only when you hand in, or when the time is up.</p>
            <p>The clock starts when you do.</p></div>`
        : boardHtml(qs[q]);
    }
    if (phase === 0) return;
    const lv = qs[q], a = ans[q], done = phase === 2;
    const gap = root.querySelector('.mx-gap'), show = done ? lv.answer : a;
    gap.innerHTML = show >= 0 ? panelSvg(lv.layout, lv.options[show]) : '<span>?</span>';
    gap.classList.toggle('filled', show >= 0);
    gap.classList.toggle('key', done);
    root.querySelectorAll('.mx-a').forEach((b, i) => {
      b.classList.toggle('chosen', !done && a === i);
      b.classList.toggle('key', done && lv.answer === i);
      b.classList.toggle('wrong', done && a === i && a !== lv.answer);
      b.setAttribute('aria-label', `Answer ${LETTER[i]}` + (done ? (lv.answer === i ? ', right' : a === i ? ', your answer, wrong' : '') : a === i ? ', chosen' : ''));
    });
  }

  function go(i) { clearTimeout(advance); q = Math.max(0, Math.min(qs.length - 1, i)); confirm = false; ctx.refresh(); }
  // Choosing an answer moves on to the next question without one, after a moment to see the choice.
  function choose(i) {
    if (phase !== 1) return;
    ans[q] = i; confirm = false;
    ctx.refresh();
    clearTimeout(advance);
    const from = q;
    advance = setTimeout(() => {
      if (phase !== 1 || q !== from) return;
      const next = [...ans.keys()].map((k) => (from + 1 + k) % ans.length).find((k) => ans[k] < 0);
      if (next != null) go(next);
    }, 280);
  }
  function handIn() { clearTimeout(advance); phase = 2; q = 0; confirm = false; ctx.refresh(); }

  function tierScore() {
    return [1, 2, 3, 4].map((t) => {
      const idx = qs.map((l, i) => i).filter((i) => qs[i].tier === t);
      return `${TIER_NAME[t]} ${idx.filter((i) => ans[i] === qs[i].answer).length}/${idx.length}`;
    }).join(' · ');
  }

  function rulesHtml() {
    const card = Rules.card;
    const row = [[[0, 2, 0]], [[1, 2, 0]], [[4, 2, 0]], [[1, 2, 2]], [[4, 2, 2]], [[0, 2, 2]], [[4, 2, 4]], [[0, 2, 4]], null];
    const clock = `<svg class="mini" viewBox="0 0 128 96" role="img" aria-label="A stopwatch"><rect width="128" height="96" rx="4" style="fill:var(--mx-gap)"/><circle cx="64" cy="52" r="28" fill="none" style="stroke:var(--accent)" stroke-width="5"/><path d="M64 52V34M64 52l11 8M56 16h16" style="stroke:var(--accent)" stroke-width="5" stroke-linecap="round"/></svg>`;
    return [
      card('01', 'A timed test', '25 questions in 20 minutes, or 50 in 40. They go from easy to hard and most of them are hard: like a real admission test, few finish them all. The clock starts when you tap Start.', clock),
      card('02', 'No answers until the end', 'Each question is a grid with its last figure missing, as in Matrix. Tap an answer to choose it; you can change it, skip a question and come back. Nothing shows right or wrong until you hand in or the time is up.',
        strip('centre', row, 3, 'A grid of shapes with the last one missing')),
      card('03', 'Your score', 'The score is how many you got right, with a count for each level of difficulty. It is not an IQ: an IQ needs questions tried out on a large group of people, and these never were. Compare it with your own earlier tests instead.',
        `<svg class="mini" viewBox="0 0 128 96" role="img" aria-label="A score"><rect width="128" height="96" rx="4" style="fill:var(--mx-gap)"/><text x="64" y="60" text-anchor="middle" font-size="30" font-weight="700" style="fill:var(--accent);font-family:var(--display)">18/25</text></svg>`),
      card('04', 'New every time', 'Every test has new questions. Afterwards you can go through each one with the right answer and its rules in words. To learn the patterns first, play Matrix: it tells you at once and has hints.',
        strip('grid4', [[[1, 4, 1, 4]], [[3, 4, 1, 4]], [[7, 4, 1, 4]]], 3, 'One, two, then three dots')),
    ].join('');
  }

  Puzzles.register({
    id: 'mtest', name: 'Matrix Test', tagline: '25 or 50 questions against the clock, scored at the end, like an admission test.', accent: '#ff9a76',
    logo: EXAM_LOGO,
    levels: FORMATS,
    heading: (l) => `Test · ${l.n}`,
    subtitle: (l) => `${l.mins} minutes`,
    sections: () => [{ title: 'Tests', items: FORMATS }],
    badge: (l) => { const b = bestOf(l.n); return b >= 0 ? b + '/' + l.n : ''; },
    bestText: (l) => { const b = bestOf(l.n); return b >= 0 ? `Best ${b}/${l.n}` : ''; },
    limit: (l) => l.mins * 60,
    timeUp() { if (phase === 1) handIn(); },
    card() {
      const b = Math.max(...FORMATS.map((f) => (bestOf(f.n) >= 0 ? bestOf(f.n) / f.n : -1)));
      const last = history[history.length - 1];
      return {
        prog: history.length ? `${history.length} ${history.length > 1 ? 'tests' : 'test'} taken · last ${last.right}/${last.n}` : 'Not taken yet',
        go: b >= 0 ? 'Take a test' : 'Take the test',
      };
    },
    init(c) {
      ctx = c;
      c.board.innerHTML = '<div class="mx"></div>';
      root = c.board.firstChild;
      root.addEventListener('click', (e) => { const b = e.target.closest('.mx-a'); if (b) choose(+b.dataset.i); });
    },
    load(l) {
      fm = l; seed = newSeed(); qs = questions(seed);
      ans = new Array(fm.n).fill(-1); q = 0; phase = 0; confirm = false; shownKey = '';
      clearTimeout(advance);
      layoutBoard(root, ctx.width(), ctx.height());
    },
    render,
    resize() { layoutBoard(root, ctx.width(), ctx.height()); },
    snapshot: () => ({ seed, ans: ans.slice(), q, phase }),
    restore(s) {
      if (s.seed !== seed) { seed = s.seed; qs = questions(seed); }
      ans = s.ans.slice(); q = s.q; phase = s.phase; confirm = false; shownKey = '';
    },
    reset() { ans = new Array(fm.n).fill(-1); q = 0; phase = 0; confirm = false; shownKey = ''; },
    started: () => phase > 0,
    fill: true,
    solved: () => phase === 2,
    onSolved() {
      history.push({ n: fm.n, right: right(), secs: ctx.secs, at: Date.now() });
      history = history.slice(-50);
      store.set('mtest.history', history);
    },
    winTitle: () => `Score ${right()} of ${fm.n}`,
    winNote() {
      const prev = history.slice(0, -1).filter((h) => h.n === fm.n);
      const best = prev.reduce((b, h) => Math.max(b, h.right), -1);
      const r = right();
      return tierScore() + (best < 0 ? '' : r > best ? ` · New best (was ${best})` : ` · Best ${best}`);
    },
    status() {
      if (phase === 0) return { count: `<b>${fm.n}</b> questions`, msg: 'Tap Start when you are ready.', bad: false };
      return { count: `Question <b>${q + 1}</b> of ${fm.n}`, msg: `${answered()} answered`, bad: false };
    },
    explain() {
      if (phase === 1 && confirm) {
        const u = fm.n - answered();
        return { label: 'Hand in?', text: `${u} ${u > 1 ? 'questions have' : 'question has'} no answer. Tap Yes, hand in to finish, or go back to ${u > 1 ? 'them' : 'it'}.` };
      }
      if (phase !== 2) return null;
      const lv = qs[q], a = ans[q];
      const verdict = a < 0 ? 'No answer' : a === lv.answer ? 'Right' : `Wrong (you chose ${LETTER[a]})`;
      return { label: `Question ${q + 1} · ${TIER_NAME[lv.tier]} · ${verdict}`, text: `The answer is ${LETTER[lv.answer]}. ${whyText(lv)}` };
    },
    controls() {
      if (phase === 0) return [{ id: 'start', label: 'Start', primary: true }];
      const nav = [{ id: 'prev', label: '‹ Back', disabled: q === 0 }, { id: 'next', label: 'Next ›', disabled: q === fm.n - 1 }];
      if (phase === 1) return nav.concat({ id: 'hand', label: confirm ? 'Yes, hand in' : 'Hand in', primary: confirm || answered() === fm.n });
      return nav.concat({ id: 'new', label: 'New test', primary: true });
    },
    press(id) {
      if (id === 'start') { phase = 1; ctx.refresh(); }
      else if (id === 'prev') go(q - 1);
      else if (id === 'next') go(q + 1);
      else if (id === 'hand') { if (confirm || answered() === fm.n) handIn(); else { confirm = true; ctx.refresh(); } }
      else if (id === 'new') ctx.restart();
    },
    hint: () => null,
    clearHint() {},
    rulesHtml,
    // For the tests in test/.
    dbg: {
      get qs() { return qs; }, get ans() { return ans; }, get phase() { return phase; }, get q() { return q; },
      choose(i, k) { if (k != null) q = k; ans[q] = i; ctx.refresh(); },
    },
  });
}
