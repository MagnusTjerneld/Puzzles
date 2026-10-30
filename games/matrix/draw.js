// Matrix: drawing and words shared by Matrix (game.js) and Matrix Test (exam.js). The build includes this file in
// the same scope, before both.
const TIER_NAME = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert' };
const LETTER = 'ABCDEFGH';

// ---------- Drawing ----------
// A panel is drawn in a 100 x 100 box, black on paper, like a printed test.
const INK = '#1b1b1a';
// Shades a fifth of the way apart in lightness (CIE L* 100, 78, 55, 33, 10): the light end used to be the closest,
// where a small shape's outline already makes its fill hard to read.
const SHADE = ['#ffffff', '#c2bfb6', '#87847c', '#4f4d48', '#1d1c1a'];
// Shapes are scaled so that one size looks the same size whatever the shape: a triangle with the circle's radius
// looks small, a square looks big.
const NORM = [1.12, 0.98, 0.97, 0.96, 0.88];
// Where each kind of single shape sits, its radius for each size, and its stroke. Sizes grow by a constant ratio
// (about 1.35 to 1.5), not a constant step: the eye compares sizes by ratio, so equal steps made the big sizes
// nearly indistinguishable. Each table is as wide as its room allows.
const SLOT = {
  c: { x: 50, y: 50, r: [11, 15, 20.5, 28, 38], w: 2.4 },
  l: { x: 27, y: 50, r: [8, 11.2, 15.7, 22], w: 2.2 },
  r: { x: 73, y: 50, r: [8, 11.2, 15.7, 22], w: 2.2 },
  o: { x: 50, y: 50, r: [40], w: 2.4 },
  i: { x: 50, y: 50, r: [7, 10, 14, 19.5], w: 2.2 },
  m: { x: 50, y: 50, r: [7, 10, 14, 20], w: 2.2 },
};
const GRID = { 4: { at: [28, 72], r: [7, 11.5, 19], w: 2 }, 9: { at: [20, 50, 80], r: [5, 8, 12.5], w: 1.6 } };
// The ring of eight round the frame, clockwise from the top left corner, with room for a shape in the middle.
const RING = { at: [[16, 16], [50, 16], [84, 16], [84, 50], [84, 84], [50, 84], [16, 84], [16, 50]], r: [4.5, 6.5, 9.5], w: 1.5 };
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

// ---- The figures that are not shapes on a grid. Directions are eighths, clockwise from up.
const path = (d, w = 3.4) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const pt = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);
// The unit vector of direction o (in eighths), turned by deg more degrees.
const dirv = (o, deg = 0) => { const a = (o * 45 + deg) * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; };
// An arrow through the middle, with n heads at its tip, in the middle or at its tail (h), all pointing its way.
function arrowBody([o, h, n]) {
  const [dx, dy] = dirv(o), L = 36, gap = 8, at = (t) => [50 + dx * t, 50 + dy * t];
  let d = `M${pt(...at(-L))}L${pt(...at(L))}`;
  // Where the first head's point sits along the arrow; the rest follow behind it.
  const first = [L, (n - 1) * gap / 2 + 5, -L + 11 + (n - 1) * gap][h];
  for (let k = 0; k < n; k++) {
    const [x, y] = at(first - k * gap);
    const [ax, ay] = dirv(o, 180 - 38), [bx, by] = dirv(o, 180 + 38);
    d += `M${pt(x + ax * 12, y + ay * 12)}L${pt(x, y)}L${pt(x + bx * 12, y + by * 12)}`;
  }
  return path(d);
}
const HINGE_ANGLE = [26, 60, 104];
// Two arms from a hinge, opening towards o, narrow, medium or wide (a); the hinge white, grey or black (c).
function hingeBody([o, a, c]) {
  const [dx, dy] = dirv(o), hx = 50 - dx * 22, hy = 50 - dy * 22, half = HINGE_ANGLE[a] / 2;
  let d = '';
  for (const s of [-1, 1]) { const [ux, uy] = dirv(o, s * half); d += `M${pt(hx + ux * 7, hy + uy * 7)}L${pt(hx + ux * 48, hy + uy * 48)}`; }
  return path(d) + `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="6.5" fill="${SHADE[[0, 2, 4][c]]}" stroke="${INK}" stroke-width="2.6"/>`;
}
// A bar with a square and a dot (two layers) at each place: left and right end, above and below.
const BAR = [[24, -1], [76, -1], [76, 1], [24, 1]];
function barBody([q, d]) {
  let h = path('M24 50H76', 3.4);
  BAR.forEach(([x, side], k) => {
    const cy = 50 + side * 10;
    if (q >> k & 1) h += `<rect x="${x - 10}" y="${cy - 10}" width="20" height="20" fill="none" stroke="${INK}" stroke-width="3.2"/>`;
    if (d >> k & 1) h += `<circle cx="${x}" cy="${cy}" r="4" fill="${INK}"/>`;
  });
  return h;
}
// A post with a dot or a square beside each end, left and right (places 0 top left, 1 top right, 2 bottom right,
// 3 bottom left).
const POST = [[-1, 30], [1, 30], [1, 70], [-1, 70]];
function postBody([z]) {
  let h = path('M50 20V80', 3.4);
  POST.forEach(([side, cy], k) => {
    const x = Engine.dig(z, k), cx = 50 + side * 10;
    if (x === 1) h += `<circle cx="${cx}" cy="${cy}" r="4.2" fill="${INK}"/>`;
    if (x === 2) h += `<rect x="${cx - 9}" y="${cy - 9}" width="18" height="18" fill="none" stroke="${INK}" stroke-width="3.2"/>`;
  });
  return h;
}
// An axis with a triangle on either side of each end, white or dark (places as on the post).
function bowBody([f]) {
  let h = '';
  POST.forEach(([side], k) => {
    const x = Engine.dig(f, k);
    if (!x) return;
    const [y0, y1] = k < 2 ? [16, 46] : [54, 84];
    h += `<polygon points="50,${y0} 50,${y1} ${50 + side * 25},${(y0 + y1) / 2}" fill="${SHADE[x === 1 ? 0 : 3]}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
  });
  return h + path('M50 12V88', 3.4);
}
// A post with stacks of pieces: black ones (b) and white ones (w) on the left when plus, on the right when minus,
// black at the bottom.
function scaleBody([b, w, t]) {
  let h = path('M50 14V86', 3.2);
  for (const side of [-1, 1]) {
    const stack = [];
    if (Math.sign(b) === -side) for (let k = 0; k < Math.abs(b); k++) stack.push(SHADE[4]);
    if (Math.sign(w) === -side) for (let k = 0; k < Math.abs(w); k++) stack.push(SHADE[0]);
    stack.forEach((fill, k) => { h += shape(t, 50 + side * 13, 76 - k * 16.5, 8, fill, 2); });
  }
  return h;
}
// Three shapes in a row, each black or white.
const row3Body = (xs) => xs.map((x, k) => shape(x >> 1, 20 + k * 30, 50, 11.5, SHADE[x & 1 ? 4 : 0], 2.2)).join('');
const BODY = { arrow: arrowBody, hinge: hingeBody, bar: barBody, post: postBody, bow: bowBody, scale: scaleBody, row3: row3Body };

function panelBody(layout, p) {
  let h = '';
  Engine.LAYOUTS[layout].forEach((spec, ci) => {
    const v = p[ci];
    if (BODY[spec.kind]) h += BODY[spec.kind](v);
    else if (spec.kind === 'shape') {
      const s = SLOT[spec.slot];
      h += shape(v[0], s.x, s.y, s.r[v[1]], SHADE[v[2]], s.w);
    } else if (spec.ring) {
      RING.at.forEach(([x, y], k) => { if (v[0] >> k & 1) h += shape(v[1], x, y, RING.r[v[2]], SHADE[v[3]], RING.w); });
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

// The grid and the eight answers of a level, as markup; the game sets the state classes.
function boardHtml(lv) {
  const L = lv.layout;
  return `<div class="mx-m" role="img" aria-label="Three rows of three figures, the last one missing">`
    + lv.cells.map((p) => `<div class="mx-c">${panelSvg(L, p)}</div>`).join('')
    + '<div class="mx-c mx-gap"></div></div>'
    + '<div class="mx-sep" aria-hidden="true"></div>'
    + '<div class="mx-o">' + lv.options.map((p, i) => `<button type="button" class="mx-a" data-i="${i}">${panelSvg(L, p)}<span class="mx-l">${LETTER[i]}</span></button>`).join('') + '</div>';
}

// Lays the grid and the answers out on a board of W x H, the panels as large as it allows: the answers under the
// grid (three by two) or beside it (two by three), whichever gives larger panels. Every panel is the same size.
function layoutBoard(root, W, H) {
  W = Math.floor(W); H = Math.floor(H || W);
  // g: between panels; G: on either side of the line that separates the grid from the answers (2 px).
  const g = Math.max(4, Math.round(Math.min(W, H) * 0.016)), G = Math.round(g * 1.8), sep = 2 * G + 2;
  const under = Math.min((W - 2 * g) / 3, (H - 3 * g - sep) / 5);
  const beside = Math.min((W - 3 * g - sep) / 5, (H - 2 * g) / 3);
  const side = beside > under * 1.04;
  const m = Math.max(20, Math.floor(Math.min(side ? beside : under, 170)));
  root.style.width = W + 'px'; root.style.height = H + 'px';
  root.classList.toggle('side', side);
  root.style.setProperty('--m', m + 'px'); root.style.setProperty('--g', g + 'px'); root.style.setProperty('--G', G + 'px');
}

// ---------- Words ----------
const ATTR_WORD = { t: 'shape', s: 'size', c: 'shade', n: 'count', p: 'places', l: 'lines', r: 'shapes', z: 'dots and squares', f: 'triangles' };
// Names that depend on the kind of figure.
const KIND_WORD = {
  arrow: { o: 'direction', h: 'heads', n: 'number of heads' },
  hinge: { o: 'direction', a: 'angle', c: 'hinge' },
  bar: { q: 'squares', d: 'dots' },
  scale: { b: 'black pieces', w: 'white pieces', t: 'shape' },
};
const SIDE_WORD = { l: 'left', r: 'right', o: 'outer', i: 'inner', m: 'middle' };
const SHAPE_NAME = ['triangle', 'square', 'pentagon', 'hexagon', 'circle'];
const SHADE_NAME = ['white', 'light grey', 'grey', 'dark grey', 'black'];
const HINGE_SHADE = ['white', 'grey', 'black'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const valueOf = (lv, p, ru) => Engine.get(Engine.LAYOUTS[lv.layout][ru.c], p[ru.c], ru.a);
const LINE_WORD = { rows: 'row', cols: 'column', diag: 'diagonal', anti: 'diagonal' };
const ALONG = { rows: 'along the row', cols: 'down the column', diag: 'down the diagonal to the right', anti: 'down the diagonal to the left' };
// Combining rules talk about the first, second and third panel: say which way they are counted.
const EACH = { rows: '', cols: 'in each column, ', diag: 'on each diagonal down to the right, ', anti: 'on each diagonal down to the left, ' };

// What rule ru says, in words, as a full sentence. Rules run along the rows, or (ru.d) down the columns or the
// diagonals, which carry on from the other side of the grid.
function ruleText(lv, ru) {
  const spec = Engine.LAYOUTS[lv.layout][ru.c], a = ru.a, k = ru.k, dir = ru.d || 'rows', cls = Engine.CLASS[a];
  const word = (KIND_WORD[spec.kind] || {})[a] || ATTR_WORD[a];
  const label = cap(spec.ring ? 'ring ' + word : spec.kind === 'shape' && spec.slot !== 'c' ? SIDE_WORD[spec.slot] + ' ' + word : word);
  const line = LINE_WORD[dir], along = ALONG[dir], each = EACH[dir];
  const first = Engine.LINES[dir][0].map((i) => valueOf(lv, lv.cells[i], ru)).sort((x, y) => x - y);
  const steps = (one, many) => ({ up1: `one ${one}`, down1: `one ${many}`, up2: `two ${one}`, down2: `two ${many}` })[k];
  const way = k.startsWith('ccw') ? 'anticlockwise' : 'clockwise';
  let s;
  if (k === 'const') s = { p: `the same places are filled in every panel of a ${line}`, l: `the same figure all ${along.replace('the', 'each')}` }[a] || `the same all ${along.replace('the', 'each')}`;
  else if (k === 'dist') {
    s = {
      t: `every ${line} has a ${and(first.map((x) => SHAPE_NAME[x]))}`,
      s: `every ${line} has the same three sizes`,
      c: `every ${line} has ${and(first.map((x) => (spec.kind === 'hinge' ? HINGE_SHADE : SHADE_NAME)[x]))}`,
      n: `every ${line} has ${and(first.map(String))} of them`,
      p: `every ${line} uses the same three patterns`,
      l: `every ${line} uses the same three figures`,
      o: `every ${line} points the same three ways`,
      h: `every ${line} has them at the tip, in the middle and at the tail`,
      a: `every ${line} has a narrow, a medium and a wide one`,
      b: `every ${line} has the same three counts`,
      w: `every ${line} has the same three counts`,
    }[a] || `every ${line} uses the same three patterns`;
    s += ', each time in a new order';
  } else if (cls === 'cyc') s = `turns ${k.endsWith('1') ? 'an eighth' : 'a quarter'} ${way} at each step ${along}`;
  else if (cls === 'seq') s = k === 'shl' ? `the three move one place to the left at each step ${along}, the first going to the end` : `the three move one place to the right at each step ${along}, the last going to the front`;
  else if (cls === 'fold') {
    const [ft, fb] = Engine.FOLDS[k], side = (x) => (x ? 'right' : 'left');
    s = `at each step ${along} one end folds over: first the top to the ${side(ft)}, then the bottom to the ${side(fb)}. Where a triangle lands on another, the dark one shows`;
  } else if (cls === 'tern') s = each + 'count a dot as one and a square as two, place by place: the third panel is the first two added, going round after two (a dot and a dot make a square, a dot and a square cancel out, two squares make a dot)';
  else if (cls === 'set' && (k === 'cw1' || k === 'ccw1' || k === 'cw2')) {
    if (a === 'l') s = `the figure turns ${k === 'cw2' ? 'half way round' : 'a quarter ' + way} at each step ${along}`;
    else if (spec.n === 4) s = `the filled places turn ${k === 'cw2' ? 'half way round' : 'a quarter ' + way} at each step ${along}`;
    else s = `the shapes move ${k === 'cw2' ? 'two places' : 'one place'} ${way} round the ${spec.ring ? 'ring' : 'frame'} at each step ${along}` + (spec.n === 9 ? ' (the centre stays)' : '');
  } else if (a === 'b' || a === 'w') {
    s = {
      add: each + 'count those on the left as plus and those on the right as minus: the third panel is the first two added, so pieces on opposite sides cancel out',
      sub: each + 'count those on the left as plus and those on the right as minus: the third panel is the first less the second',
    }[k] || `${steps('more', 'more')} on the ${k.startsWith('up') ? 'left (or fewer on the right)' : 'right (or fewer on the left)'} at each step ${along}`;
  } else if (a === 't') s = `${k === 'up1' ? 'one more corner' : 'one corner fewer'} at each step ${along}`;
  else if (a === 's') s = `${k.startsWith('up') ? 'grows' : 'shrinks'} by ${k.endsWith('1') ? 'one size' : 'two sizes'} at each step ${along}`;
  else if (a === 'c') s = `${k.endsWith('1') ? 'one shade' : 'two shades'} ${k.startsWith('up') ? 'darker' : 'lighter'} at each step ${along}`;
  else if (a === 'h') s = `they move ${k.endsWith('1') ? 'one place' : 'two places'} ${k.startsWith('up') ? 'back' : 'forward'} (tip, middle, tail) at each step ${along}`;
  else if (a === 'a') s = `opens ${k.endsWith('2') ? 'two steps' : 'a step'} ${k.startsWith('up') ? 'wider' : 'narrower'} at each step ${along}`;
  else if (a === 'n') {
    s = {
      add: each + 'the third panel has as many as the first two together',
      sub: each + 'the third panel has as many as the first, less the second',
    }[k] || `${steps('more', 'fewer')} at each step ${along}`;
  } else if (a === 'p' || a === 'q' || a === 'd') {
    const turned = k.endsWith('m') && k !== 'm' ? ', and then the bar is turned over: above and below swap' : '';
    s = each + {
      or: 'the third panel fills every place that is filled in the first or the second',
      and: 'the third panel fills only the places filled in both the first and the second',
      xor: 'lay the first two panels on top of each other: a place filled in both goes empty, a place filled in one stays',
      minus: 'the third panel is the first with the places of the second emptied',
    }[k.replace(/m$/, '')] + turned;
  } else {
    s = each + {
      or: 'the third figure is the first two laid on top of each other',
      and: 'the third figure keeps only the lines the first two share',
      xor: 'lay the first two figures on top of each other: lines in both cancel out, the rest stay',
      minus: 'the third figure is the first with the lines of the second taken away',
    }[k];
  }
  return `${label}: ${s}${ru.d === 'diag' || ru.d === 'anti' ? ' (the diagonals carry on from the other side of the grid)' : ''}.`;
}

// The rules that tell the right answer from the wrong ones (the ones Hint would name), in words.
function whyText(lv) {
  const right = lv.options[lv.answer];
  return lv.rules.filter((ru) => lv.options.some((o) => valueOf(lv, o, ru) !== valueOf(lv, right, ru))).map((ru) => ruleText(lv, ru)).join(' ');
}

// ---------- Pictures for the rules ----------
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
