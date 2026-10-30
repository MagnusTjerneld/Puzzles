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

function panelBody(layout, p) {
  let h = '';
  Engine.LAYOUTS[layout].forEach((spec, ci) => {
    const v = p[ci];
    if (spec.kind === 'shape') {
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
    + '<div class="mx-o">' + lv.options.map((p, i) => `<button type="button" class="mx-a" data-i="${i}">${panelSvg(L, p)}<span class="mx-l">${LETTER[i]}</span></button>`).join('') + '</div>';
}

// ---------- Words ----------
const ATTR_WORD = { t: 'shape', s: 'size', c: 'shade', n: 'count', p: 'places', l: 'lines' };
const SIDE_WORD = { l: 'left', r: 'right', o: 'outer', i: 'inner', m: 'middle' };
const SHAPE_NAME = ['triangle', 'square', 'pentagon', 'hexagon', 'circle'];
const SHADE_NAME = ['white', 'light grey', 'grey', 'dark grey', 'black'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const valueOf = (lv, p, ru) => Engine.get(Engine.LAYOUTS[lv.layout][ru.c], p[ru.c], ru.a);

// What rule ru says, in words, as a full sentence. Rules run along the rows, or (ru.d === 'cols') down the columns.
function ruleText(lv, ru) {
  const spec = Engine.LAYOUTS[lv.layout][ru.c], a = ru.a, k = ru.k, cols = ru.d === 'cols';
  const label = cap(spec.ring ? 'ring ' + ATTR_WORD[a] : spec.kind === 'shape' && spec.slot !== 'c' ? SIDE_WORD[spec.slot] + ' ' + ATTR_WORD[a] : ATTR_WORD[a]);
  const line = cols ? 'column' : 'row', along = cols ? 'down the column' : 'along the row';
  const first = (cols ? [0, 3, 6] : [0, 1, 2]).map((i) => valueOf(lv, lv.cells[i], ru)).sort((x, y) => x - y);
  const steps = (one, many) => ({ up1: `one ${one}`, down1: `one ${many}`, up2: `two ${one}`, down2: `two ${many}` })[k];
  // Combining rules talk about the first, second and third panel: say which way they are counted.
  const each = cols ? 'in each column, ' : '';
  const way = k === 'ccw1' ? 'anticlockwise' : 'clockwise';
  let s;
  if (k === 'const') s = { p: `the same places are filled in every panel of a ${line}`, l: `the same figure all ${along.replace('the', 'each')}` }[a] || `the same all ${along.replace('the', 'each')}`;
  else if (k === 'dist') {
    s = {
      t: `every ${line} has a ${and(first.map((x) => SHAPE_NAME[x]))}`,
      s: `every ${line} has the same three sizes`,
      c: `every ${line} has ${and(first.map((x) => SHADE_NAME[x]))}`,
      n: `every ${line} has ${and(first.map(String))} of them`,
      p: `every ${line} uses the same three patterns`,
      l: `every ${line} uses the same three figures`,
    }[a] + ', each time in a new order';
  } else if (k === 'cw1' || k === 'ccw1' || k === 'cw2') {
    if (a === 'l') s = `the figure turns ${k === 'cw2' ? 'half way round' : 'a quarter ' + way} at each step ${along}`;
    else if (spec.n === 4) s = `the filled places turn ${k === 'cw2' ? 'half way round' : 'a quarter ' + way} at each step ${along}`;
    else s = `the shapes move ${k === 'cw2' ? 'two places' : 'one place'} ${way} round the ${spec.ring ? 'ring' : 'frame'} at each step ${along}` + (spec.n === 9 ? ' (the centre stays)' : '');
  } else if (a === 't') s = `${k === 'up1' ? 'one more corner' : 'one corner fewer'} at each step ${along}`;
  else if (a === 's') s = `${k.startsWith('up') ? 'grows' : 'shrinks'} by ${k.endsWith('1') ? 'one size' : 'two sizes'} at each step ${along}`;
  else if (a === 'c') s = `${k.endsWith('1') ? 'one shade' : 'two shades'} ${k.startsWith('up') ? 'darker' : 'lighter'} at each step ${along}`;
  else if (a === 'n') {
    s = {
      add: each + 'the third panel has as many as the first two together',
      sub: each + 'the third panel has as many as the first, less the second',
    }[k] || `${steps('more', 'fewer')} at each step ${along}`;
  } else if (a === 'p') {
    s = each + {
      or: 'the third panel fills every place that is filled in the first or the second',
      and: 'the third panel fills only the places filled in both the first and the second',
      xor: 'lay the first two panels on top of each other: a place filled in both goes empty, a place filled in one stays',
      minus: 'the third panel is the first with the places of the second emptied',
    }[k];
  } else {
    s = each + {
      or: 'the third figure is the first two laid on top of each other',
      and: 'the third figure keeps only the lines the first two share',
      xor: 'lay the first two figures on top of each other: lines in both cancel out, the rest stay',
      minus: 'the third figure is the first with the lines of the second taken away',
    }[k];
  }
  return `${label}: ${s}.`;
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
