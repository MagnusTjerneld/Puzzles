# Independent check of levels.json: no two levels follow the same pattern of rules, the values are in range, the eight answers differ, the stored rules hold along
# the rows with the right answer in place, and the right answer is the only one of the eight that every attribute
# accepts (explained by a rule along the rows or down the columns, or left free by the matrix).
# Turns are worked out here from the geometry (coordinates turned about the centre), not copied from engine.js.
# Written apart from engine.js on purpose. Run: python3 games/matrix/verify.py
import json, sys, os

# Default: the level bank. With a path: that file, which may also hold a list of sets (sampled Matrix Tests, from
# test/exam-sample.js), each checked on its own.
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')
data = json.load(open(path))
sets = data if data and isinstance(data[0], list) else [data]

# component kind, then the number of values per attribute (n: places or strokes)
LAYOUTS = {
    'centre': [('shape', {'t': 5, 's': 5, 'c': 5})],
    'lr': [('shape', {'t': 5, 's': 4, 'c': 5}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'oi': [('shape', {'t': 5, 's': 1, 'c': 3}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'grid4': [('grid', {'n': 4, 't': 5, 's': 3, 'c': 5})],
    'grid9': [('grid', {'n': 9, 't': 5, 's': 3, 'c': 5})],
    'lines': [('lines', {'n': 9})],
    'rc': [('grid', {'n': 8, 't': 5, 's': 3, 'c': 5}), ('shape', {'t': 5, 's': 4, 'c': 5})],
}
GRID_OF = {'grid4': 4, 'grid9': 9, 'lines': 'lines', 'rc': 8}


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
ATTRS = {'shape': 'tsc', 'grid': 'nptsc', 'lines': 'l'}


def value(kind, comp, a):
    if kind == 'shape':
        return comp['tsc'.index(a)]
    if kind == 'lines':
        return comp[0]
    if a == 'n':
        return bin(comp[0]).count('1')
    return comp['ptsc'.index(a)]


def is_set(a):
    return a in 'pl'


def triple_rules(a, step=None):
    # every rule as a test on one line of three, except dist, which needs all lines at once
    rules = {'const': lambda x, y, z: x == y == z}
    if is_set(a):
        for name, k in (('cw1', 1), ('ccw1', -1), ('cw2', 2)):
            if step:
                rules[name] = (lambda k: lambda x, y, z: y == step(x, k) and z == step(y, k))(k)
        rules.update({
            'or': lambda x, y, z: z == x | y,
            'and': lambda x, y, z: z == x & y,
            'xor': lambda x, y, z: z == x ^ y,
            'minus': lambda x, y, z: z == x & ~y,
        })
    else:
        for name, d in (('up1', 1), ('down1', -1), ('up2', 2), ('down2', -2)):
            rules[name] = (lambda d: lambda x, y, z: y == x + d and z == y + d)(d)
        if a != 't':
            rules['add'] = lambda x, y, z: z == x + y
            rules['sub'] = lambda x, y, z: z == x - y
    return rules


def dist(lines):
    return all(len(set(l)) == 3 for l in lines) and len({tuple(sorted(l)) for l in lines}) == 1


def fits(a, lines, step):
    if dist(lines):
        return True
    return any(all(f(*l) for l in lines) for f in triple_rules(a, step).values())


def step_of(layout, ci, a):
    # the turn of a component's places or strokes; ccw is the same table run backwards (len - 1 steps)
    if not is_set(a):
        return None
    kind = GRID_OF[layout] if layout != 'rc' or ci == 0 else None
    if kind is None:
        return None
    one = make_turn(kind)
    size = {4: 4, 9: 8, 8: 8, 'lines': 4}[kind]  # steps for a full turn
    return lambda m, k: one(m, k % size)


def accepted(layout, cells, option):
    grid = cells + [option]
    for ci, (kind, _) in enumerate(LAYOUTS[layout]):
        for a in ATTRS[kind]:
            v = [value(kind, p[ci], a) for p in grid]
            rows = [v[0:3], v[3:6], v[6:9]]
            cols = [v[0::3], v[1::3], v[2::3]]
            st = step_of(layout, ci, a)
            pinned = fits(a, rows[:2], st) or fits(a, cols[:2], st)
            if pinned and not (fits(a, rows, st) or fits(a, cols, st)):
                return False
    return True


def in_range(layout, panel):
    if len(panel) != len(LAYOUTS[layout]):
        return False
    for (kind, dom), comp in zip(LAYOUTS[layout], panel):
        if kind == 'lines':
            if len(comp) != 1 or not (0 < comp[0] < 1 << dom['n']):
                return False
            continue
        names = 'tsc' if kind == 'shape' else 'ptsc'
        if len(comp) != len(names):
            return False
        for a, x in zip(names, comp):
            hi = (1 << dom['n']) - 1 if a == 'p' else dom[a] - 1
            if not (0 <= x <= hi) or (a == 'p' and x == 0):
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
                lines = [v[0::3], v[1::3], v[2::3]] if r.get('d') == 'cols' else [v[0:3], v[3:6], v[6:9]]
                ok = dist(lines) if r['k'] == 'dist' else all(triple_rules(r['a'], step_of(layout, r['c'], r['a']))[r['k']](*l) for l in lines)
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
