# Independent check of levels.json: the values are in range, the eight answers differ, the stored rules hold along
# the rows with the right answer in place, and the right answer is the only one of the eight that every attribute
# accepts (explained by a rule along the rows or down the columns, or left free by the matrix).
# Written apart from engine.js on purpose. Run: python3 games/matrix/verify.py
import json, sys, os

levels = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')))

# component kind, then the number of values per attribute (n: places or strokes)
LAYOUTS = {
    'centre': [('shape', {'t': 5, 's': 5, 'c': 5})],
    'lr': [('shape', {'t': 5, 's': 4, 'c': 5}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'oi': [('shape', {'t': 5, 's': 1, 'c': 3}), ('shape', {'t': 5, 's': 4, 'c': 5})],
    'grid4': [('grid', {'n': 4, 't': 5, 's': 3, 'c': 5})],
    'grid9': [('grid', {'n': 9, 't': 5, 's': 3, 'c': 5})],
    'lines': [('lines', {'n': 9})],
}
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


def triple_rules(a):
    # every rule as a test on one line of three, except dist, which needs all lines at once
    rules = {'const': lambda x, y, z: x == y == z}
    if is_set(a):
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


def fits(a, lines):
    if dist(lines):
        return True
    return any(all(f(*l) for l in lines) for f in triple_rules(a).values())


def accepted(layout, cells, option):
    grid = cells + [option]
    for ci, (kind, _) in enumerate(LAYOUTS[layout]):
        for a in ATTRS[kind]:
            v = [value(kind, p[ci], a) for p in grid]
            rows = [v[0:3], v[3:6], v[6:9]]
            cols = [v[0::3], v[1::3], v[2::3]]
            pinned = fits(a, rows[:2]) or fits(a, cols[:2])
            if pinned and not (fits(a, rows) or fits(a, cols)):
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


bad = 0
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
            rows = [v[0:3], v[3:6], v[6:9]]
            ok = dist(rows) if r['k'] == 'dist' else all(triple_rules(r['a'])[r['k']](*l) for l in rows)
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
print('matrix:', len(levels), 'levels, errors:', bad)
sys.exit(1 if bad else 0)
