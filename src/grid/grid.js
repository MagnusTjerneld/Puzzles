'use strict';
// Grid kit, shared by the grid puzzles (Queens, Tango): a square n x n board drawn on a canvas in whole device pixels,
// so every line is exactly as thick as every other at any screen density, with a transparent button per cell on top.
// Also the small SVG example boards in the rules.

const Grid = {
  // Builds the canvas and the cell buttons in board. Returns the .cells element (its children are the cells).
  build(board, n) {
    board.innerHTML = '<canvas></canvas><div class="cells"></div>';
    const cells = board.lastChild;
    cells.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells.style.gridTemplateRows = `repeat(${n}, 1fr)`;
    for (let i = 0; i < n * n; i++) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'cell'; el.dataset.i = i; el.setAttribute('role', 'gridcell');
      cells.appendChild(el);
    }
    return cells;
  },

  // Sizes the canvas to width (CSS px) and lets draw(ctx2d, geo) paint it. The frame is filled with --line first.
  // geo: { dpr, thinD, frameD, cellD, size, at(k) = device px where row/column k starts, col(name, fallback) }
  fit(board, n, width, draw) {
    const dpr = window.devicePixelRatio || 1;
    const thinD = Math.max(1, Math.round(dpr));        // a line between two cells
    const frameD = Math.max(4, Math.round(4.5 * dpr));  // the frame round the whole board
    const availD = Math.floor(width * dpr);
    const cellD = Math.max(16, Math.floor((availD - 2 * frameD) / n));
    const size = n * cellD + 2 * frameD;
    const cv = board.firstChild, css = (d) => Math.ceil((d / dpr) * 64) / 64;
    cv.width = size; cv.height = size;
    cv.style.width = css(size) + 'px'; cv.style.height = css(size) + 'px';
    board.style.setProperty('--lp', css(frameD) + 'px');
    // Put the board exactly on a whole device pixel, or the browser rescales the canvas and the lines differ in thickness.
    board.style.top = '0px';
    const topD = cv.getBoundingClientRect().top * dpr;
    board.style.top = Math.ceil(((Math.round(topD) - topD) / dpr) * 64) / 64 + 'px';

    const ctx = cv.getContext('2d'), cs = getComputedStyle(board);
    const col = (name, d) => cs.getPropertyValue(name).trim() || d;
    ctx.fillStyle = col('--line', '#c8ccc4'); ctx.fillRect(0, 0, size, size);
    draw(ctx, { dpr, thinD, frameD, cellD, size, at: (k) => frameD + k * cellD, col });
  },

  // The cell under a point (client coordinates), or -1.
  cellAt(board, n, x, y) {
    const cells = board.lastChild, r = cells.getBoundingClientRect(), pad = parseFloat(getComputedStyle(cells).paddingLeft) || 0;
    const size = (r.width - 2 * pad) / n, c = Math.floor((x - r.left - pad) / size), row = Math.floor((y - r.top - pad) / size);
    return c >= 0 && c < n && row >= 0 && row < n ? row * n + c : -1;
  },

  // A small example board as SVG, drawn with the game's own colours and marks instead of a screenshot.
  // o: { rows, cols, label, why: [cells] (stripes), bad: [cells] (hatching and frame), hint: [cells] (white frame) }
  // look: { fill(i) css colour of a cell, lines(at, s) svg path of the grid lines, mark(i, x, y, s, bad) svg of a cell's symbol,
  //         after(at, s) extra svg on top }
  mini(o, look) {
    const R = o.rows, C = o.cols, N = R * C, s = 24, f = 2, W = C * s + 2 * f, H = R * s + 2 * f;
    const at = (k) => f + k * s, has = (a, i) => (a || []).includes(i);
    let h = `<svg class="mini" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || ''}"><rect width="${W}" height="${H}" style="fill:var(--line)"/>`;
    for (let i = 0; i < N; i++) h += `<rect x="${at(i % C)}" y="${at((i / C) | 0)}" width="${s}" height="${s}" style="fill:${look.fill(i)}"/>`;
    const ln = look.lines(at, s);
    if (ln) h += `<path d="${ln}" style="fill:var(--ink)"/>`;
    for (let i = 0; i < N; i++) {
      const x = at(i % C), y = at((i / C) | 0), bad = has(o.bad, i);
      if (has(o.why, i)) h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#p-why)"/>`;
      h += look.mark(i, x, y, s, bad);
      if (bad) h += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#p-bad)"/>`;
      if (bad || has(o.hint, i)) h += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" fill="none" stroke="#fff" stroke-width="2"/>`;
    }
    if (look.after) h += look.after(at, s);
    return h + '</svg>';
  },

  // A rules card: number, title, text, picture on the left, optional verdict below the text.
  card: (num, title, text, pic, extra) => `<section class="rule"><div class="pic">${pic}</div><div><h3><span class="n">${num}</span>${title}</h3><p>${text}</p>${extra || ''}</div></section>`,
  WRONG: '<span class="verdict bad">Wrong</span>',
  RIGHT: '<span class="verdict good">Right</span>',
};
