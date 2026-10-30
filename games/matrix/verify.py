# Independent check of levels.json: no two levels follow the same pattern of rules, the values are in range, the eight answers differ, the stored rules hold along
# their lines with the right answer in place, and the right answer is the only one of the eight that every attribute
# accepts (explained by a rule along the rows, down the columns or along a diagonal, or left free by the matrix).
# Turns, the bar turned over, folds and the diagonals are worked out here from the geometry (coordinates), not
# copied from engine.js.
# Written apart from engine.js on purpose. Run: python3 games/matrix/verify.py
import json, sys, os

# Default: the level bank. With a path: that file, which may also hold a list of sets (sampled Matrix Tests, from
# test/exam-sample.js), each checked on its own.
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')
data = json.load(open(path))
sets = data if data and isinstance(data[0], list) else [data]

# component kind, then the values per attribute: a count of values (0 .. count - 1), or (lo, hi); n: places or strokes
LAYOUTS = {
    'centre': [('shape', {'t': 5, 's': 5, 'c': 5})],
    'lr': [('shape', {'t': 5, 's': 4, 'c': 5}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'oi': [('shape', {'t': 5, 's': 1, 'c': 3}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'grid4': [('grid', {'n': 4, 't': 5, 's': 3, 'c': 5})],
    'grid9': [('grid', {'n': 9, 't': 5, 's': 3, 'c': 5})],
    'lines': [('lines', {'n': 9})],
    'rc': [('grid', {'n': 8, 't': 5, 's': 3, 'c': 5}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'arrow': [('arrow', {'o': 8, 'h': 3, 'n': (1, 3)})],
    'hinge': [('hinge', {'o': 8, 'a': 3, 'c': 3})],
    'bar': [('bar', {'n': 4})],
    'post': [('post', {})],
    'bow': [('bow', {})],
    'scale': [('scale', {'b': (-2, 2), 'w': (-2, 2), 't': 5})],
    'row3': [('row3', {})],
}
GRID_OF = {'grid4': 4, 'grid9': 9, 'lines': 'lines', 'rc': 8}
# stored order of the attributes of each kind (a grid's count n is worked out from its places)
STORED = {'shape': 'tsc', 'grid': 'ptsc', 'lines': 'l', 'arrow': 'ohn', 'hinge': 'oac', 'bar': 'qd', 'post': 'z', 'bow': 'f', 'scale': 'bwt'}
ATTRS = {'shape': 'tsc', 'grid': 'nptsc', 'lines': 'l', 'arrow': 'ohn', 'hinge': 'oac', 'bar': 'qd', 'post': 'z', 'bow': 'f', 'scale': 'bwt', 'row3': 'r'}
# what sort of thing an attribute is
SORT = {'t': 'type', 'h': 'type', 'a': 'type', 's': 'num', 'c': 'num', 'n': 'num', 'b': 'num', 'w': 'num',
        'p': 'set', 'l': 'set', 'q': 'set', 'd': 'set', 'o': 'dir', 'z': 'three', 'f': 'fold', 'r': 'row'}


def make_turn(kind):
    # one clockwise step, as a function on bitmasks
    if kind == 4:  # 2 x 2 places (row, col), bit = row * 2 + col; a quarter turn: (r, c) -> (c, 1 - r)
        dest = {r * 2 + c: c * 2 + (1 - r) for r in range(2) for c in range(2)}
    elif kind == 9:  # the eight outer places go one place round the frame, the centre stays
        ring = [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 1), (2, 0), (1, 0)]
        dest = {r * 3 + c: ring[(i + 1) % 8][0] * 3 + ring[(i + 1) % 8][1] for i, (r, c) in enumerate(ring)}
        dest[4] = 4
    elif kind == 8:  # a ring of eight, numbered clockwise
        dest = {i: (i + 1) % 8 for i in range(8)}
    else:  # strokes as segments; turn their end points a quarter clockwise about (50, 50): (x, y) -> (100 - y, x)
        segs = [((18, 18), (82, 18)), ((82, 18), (82, 82)), ((18, 82), (82, 82)), ((18, 18), (18, 82)),
                ((18, 18), (82, 82)), ((82, 18), (18, 82)), ((50, 18), (50, 82)), ((18, 50), (82, 50)), 'ring']
        norm = lambda sg: sg if sg == 'ring' else frozenset(sg)
        rot = lambda sg: sg if sg == 'ring' else frozenset((100 - y, x) for x, y in sg)
        index = {norm(sg): i for i, sg in enumerate(segs)}
        dest = {i: index[rot(norm(sg))] for i, sg in enumerate(segs)}
    def step(m, times):
        for _ in range(times % len(dest)):
            m = sum(1 << dest[b] for b in dest if m >> b & 1)
        return m
    return step


# The bar: its places as (end, side), end -1 left / 1 right, side -1 above / 1 below; in the stored order 0 left above,
# 1 right above, 2 right below, 3 left below. Turned over the bar: side -> -side.
BAR_PLACES = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
def bar_over(m):
    return sum(1 << BAR_PLACES.index((e, -s)) for i, (e, s) in enumerate(BAR_PLACES) if m >> i & 1)


# Post and bow: four places, (end, side), end 'top' / 'bottom', side -1 left / 1 right, stored 0 top left, 1 top right,
# 2 bottom right, 3 bottom left, one base 3 digit each.
QUAD = [('top', -1), ('top', 1), ('bottom', 1), ('bottom', -1)]
def quad(v):
    return {QUAD[i]: v // 3 ** i % 3 for i in range(4)}
def unquad(d):
    return sum(d[QUAD[i]] * 3 ** i for i in range(4))
def fold(v, end, toward):
    # one end of the bow folds over the axis toward a side; the triangle that lands on another: the darker shows
    d = quad(v)
    src, dst = (end, -toward), (end, toward)
    d[dst] = max(d[dst], d[src])
    d[src] = 0
    return unquad(d)
FOLD_WAYS = {'frr': (1, 1), 'fll': (-1, -1), 'frl': (1, -1), 'flr': (-1, 1)}  # top, then bottom


def row_items(v):
    return (v // 100, v // 10 % 10, v % 10)


def value(kind, comp, a):
    if kind == 'row3':
        return comp[0] * 100 + comp[1] * 10 + comp[2]
    if kind == 'grid' and a == 'n':
        return bin(comp[0]).count('1')
    return comp[STORED[kind].index(a)]


def triple_rules(a, step=None, over=None):
    # every rule as a test on one line of three, except dist, which needs all lines at once
    rules = {'const': lambda x, y, z: x == y == z}
    sort = SORT[a]
    if sort == 'set':
        for name, k in (('cw1', 1), ('ccw1', -1), ('cw2', 2)):
            if step:
                rules[name] = (lambda k: lambda x, y, z: y == step(x, k) and z == step(y, k))(k)
        ops = {'or': lambda x, y: x | y, 'and': lambda x, y: x & y, 'xor': lambda x, y: x ^ y}
        for name, f in ops.items():
            rules[name] = (lambda f: lambda x, y, z: z == f(x, y))(f)
            if over:
                rules[name + 'm'] = (lambda f: lambda x, y, z: z == over(f(x, y)))(f)
        rules['minus'] = lambda x, y, z: z == x & ~y
    elif sort == 'dir':
        for name, k in (('cw1', 1), ('ccw1', -1), ('cw2', 2), ('ccw2', -2)):
            rules[name] = (lambda k: lambda x, y, z: y == (x + k) % 8 and z == (y + k) % 8)(k)
    elif sort == 'three':
        rules['add3'] = lambda x, y, z: z == unquad({p: (quad(x)[p] + quad(y)[p]) % 3 for p in QUAD})
    elif sort == 'fold':
        for name, (t, b) in FOLD_WAYS.items():
            rules[name] = (lambda t, b: lambda x, y, z: y == fold(x, 'top', t) and z == fold(y, 'bottom', b))(t, b)
    elif sort == 'row':
        left = lambda v: (lambda i: i[1] * 100 + i[2] * 10 + i[0])(row_items(v))
        right = lambda v: (lambda i: i[2] * 100 + i[0] * 10 + i[1])(row_items(v))
        rules['shl'] = lambda x, y, z: y == left(x) and z == left(y)
        rules['shr'] = lambda x, y, z: y == right(x) and z == right(y)
    else:
        for name, d in (('up1', 1), ('down1', -1), ('up2', 2), ('down2', -2)):
            rules[name] = (lambda d: lambda x, y, z: y == x + d and z == y + d)(d)
        if sort == 'num':
            rules['add'] = lambda x, y, z: z == x + y
            rules['sub'] = lambda x, y, z: z == x - y
    return rules


def dist(lines):
    return all(len(set(l)) == 3 for l in lines) and len({tuple(sorted(l)) for l in lines}) == 1


def fits(a, lines, extra):
    if dist(lines):
        return True
    return any(all(f(*l) for l in lines) for f in triple_rules(a, *extra).values())


def extra_of(layout, ci, a):
    # the turn of a component's places or strokes (ccw is the same table run backwards), and turning a bar over
    if SORT[a] != 'set':
        return (None, None)
    if layout == 'bar':
        return (None, bar_over)
    kind = GRID_OF[layout] if layout != 'rc' or ci == 0 else None
    one = make_turn(kind)
    size = {4: 4, 9: 8, 8: 8, 'lines': 4}[kind]  # steps for a full turn
    return (lambda m, k: one(m, k % size), None)


# The lines of the 3 x 3 grid in every direction, as cell numbers (row * 3 + col), each from the top down: rows,
# columns, and the diagonals down to the right and to the left, which wrap round from one side to the other. The line
# through the gap (2, 2) is put last, so the first two are complete.
def directions():
    out = {'rows': [[r * 3 + c for c in range(3)] for r in range(3)], 'cols': [[r * 3 + c for r in range(3)] for c in range(3)]}
    for name, dc in (('diag', 1), ('anti', -1)):
        ls = [[r * 3 + (c0 + dc * r) % 3 for r in range(3)] for c0 in range(3)]
        out[name] = sorted(ls, key=lambda l: 8 in l)
    return out
LINES = directions()


def accepted(layout, cells, option):
    grid = cells + [option]
    for ci, (kind, _) in enumerate(LAYOUTS[layout]):
        for a in ATTRS[kind]:
            v = [value(kind, p[ci], a) for p in grid]
            ex = extra_of(layout, ci, a)
            lines = {d: [[v[i] for i in l] for l in ls] for d, ls in LINES.items()}
            pinned = any(fits(a, ls[:2], ex) for ls in lines.values())
            if pinned and not any(fits(a, ls, ex) for ls in lines.values()):
                return False
    return True


def bounds(dom, a):
    x = dom[a]
    return x if isinstance(x, tuple) else (0, x - 1)


def in_range(layout, panel):
    if len(panel) != len(LAYOUTS[layout]):
        return False
    for (kind, dom), comp in zip(LAYOUTS[layout], panel):
        if kind == 'lines':
            if len(comp) != 1 or not (0 < comp[0] < 1 << dom['n']):
                return False
        elif kind == 'row3':
            if len(comp) != 3 or not all(0 <= x <= 9 for x in comp):
                return False
        elif kind in ('post', 'bow'):
            if len(comp) != 1 or not (0 < comp[0] < 81):
                return False
        elif kind == 'bar':
            if len(comp) != 2 or not all(0 <= x < 16 for x in comp):
                return False
        else:
            names = STORED[kind]
            if len(comp) != len(names):
                return False
            for a, x in zip(names, comp):
                lo, hi = (1, (1 << dom['n']) - 1) if a == 'p' else bounds(dom, a)
                if not (lo <= x <= hi):
                    return False
    return True


def check(levels):
    bad = 0
    # No two levels may follow the same pattern: layout plus which attributes follow which rule, which way.
    patterns = {}
    for lv in levels:
        sig = (lv['layout'], tuple(sorted((r['c'], r['a'], r['k'], r.get('d', 'rows')) for r in lv['rules'] if r['k'] != 'const')))
        patterns.setdefault(sig, []).append(lv['id'])
    for ids in patterns.values():
        if len(ids) > 1:
            bad += 1
            print(ids, ['same pattern of rules'])
    for lv in levels:
        errs = []
        layout, cells, options, ans = lv['layout'], lv['cells'], lv['options'], lv['answer']
        if layout not in LAYOUTS or len(cells) != 8 or len(options) != 8 or not (0 <= ans < 8):
            errs.append('wrong shape of level')
        elif not all(in_range(layout, p) for p in cells + options):
            errs.append('value out of range')
        else:
            if len({json.dumps(o) for o in options}) != 8:
                errs.append('two answers are the same')
            grid = cells + [options[ans]]
            for r in lv['rules']:
                kind = LAYOUTS[layout][r['c']][0]
                v = [value(kind, p[r['c']], r['a']) for p in grid]
                lines = [[v[i] for i in l] for l in LINES[r.get('d', 'rows')]]
                ok = dist(lines) if r['k'] == 'dist' else all(triple_rules(r['a'], *extra_of(layout, r['c'], r['a']))[r['k']](*l) for l in lines)
                if not ok:
                    errs.append(f"rule {r} does not hold")
            good = [i for i, o in enumerate(options) if accepted(layout, cells, o)]
            if good != [ans]:
                errs.append(f'accepted answers {good}, expected [{ans}]')
            # every wrong answer must differ from the right one in an attribute some stored rule is about, so Hint
            # can cross it out with a rule it names
            for i, o in enumerate(options):
                if i != ans and not any(value(LAYOUTS[layout][r['c']][0], o[r['c']], r['a']) != value(LAYOUTS[layout][r['c']][0], options[ans][r['c']], r['a']) for r in lv['rules']):
                    errs.append(f'answer {i} breaks no stored rule')
        if errs:
            bad += 1
            print(lv['id'], errs)
    return bad


bad = sum(check(levels) for levels in sets)
print('matrix:', sum(len(x) for x in sets), 'levels in', len(sets), 'set' + ('s' if len(sets) > 1 else '') + ', errors:', bad)
sys.exit(1 if bad else 0)
