# Independent check of levels.json: exactly one solution (separate backtracking in Python), a valid stored solution,
# and that the stored solution follows every clue. Run: python3 games/tango/verify.py
import json, sys, os

levels = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')))


def valid_line(line, half, cons):
    # line: list of 0/1; cons: signs between adjacent cells (0 none, 1 =, 2 x)
    if line.count(0) != half or line.count(1) != half:
        return False
    for i in range(len(line) - 2):
        if line[i] == line[i + 1] == line[i + 2]:
            return False
    for i, t in enumerate(cons):
        if t == 1 and line[i] != line[i + 1]:
            return False
        if t == 2 and line[i] == line[i + 1]:
            return False
    return True


def count_solutions(n, given, h, v, limit=2):
    half = n // 2
    g = [-1] * (n * n)
    found = 0

    def rec(i):
        nonlocal found
        if found >= limit:
            return
        if i == n * n:
            found += 1
            return
        r, c = divmod(i, n)
        for x in (0, 1):
            if given[i] not in (-1, x):
                continue
            g[i] = x
            ok = True
            if c >= 2 and g[i - 1] == g[i - 2] == x:
                ok = False
            if ok and r >= 2 and g[i - n] == g[i - 2 * n] == x:
                ok = False
            if ok and c >= 1:
                t = h[r * (n - 1) + c - 1]
                if (t == 1 and g[i - 1] != x) or (t == 2 and g[i - 1] == x):
                    ok = False
            if ok and r >= 1:
                t = v[(r - 1) * n + c]
                if (t == 1 and g[i - n] != x) or (t == 2 and g[i - n] == x):
                    ok = False
            if ok:
                row = g[r * n:r * n + c + 1]
                col = [g[k * n + c] for k in range(r + 1)]
                if row.count(x) > half or col.count(x) > half:
                    ok = False
            if ok:
                rec(i + 1)
            g[i] = -1

    rec(0)
    return found


bad = 0
for lv in levels:
    n, given, h, v, sol = lv['n'], lv['given'], lv['h'], lv['v'], lv['solution']
    half = n // 2
    errs = []
    if len(given) != n * n or len(sol) != n * n:
        errs.append('wrong size')
    if len(h) != n * (n - 1) or len(v) != (n - 1) * n:
        errs.append('wrong number of signs')
    if not errs:
        for r in range(n):
            if not valid_line(sol[r * n:(r + 1) * n], half, [h[r * (n - 1) + c] for c in range(n - 1)]):
                errs.append(f'row {r + 1} breaks the rules')
        for c in range(n):
            if not valid_line([sol[r * n + c] for r in range(n)], half, [v[r * n + c] for r in range(n - 1)]):
                errs.append(f'column {c + 1} breaks the rules')
        if any(given[i] not in (-1, sol[i]) for i in range(n * n)):
            errs.append('prefilled cell does not match the solution')
        # no sign may touch a prefilled cell
        for i, t_ in enumerate(h):
            if t_:
                r, c = divmod(i, n - 1)
                if given[r * n + c] != -1 or given[r * n + c + 1] != -1:
                    errs.append(f'sign next to a prefilled cell (horizontal {i})')
        for i, t_ in enumerate(v):
            if t_ and (given[i] != -1 or given[i + n] != -1):
                errs.append(f'sign next to a prefilled cell (vertical {i})')
        if count_solutions(n, given, h, v) != 1:
            errs.append('not exactly one solution')
    if errs:
        bad += 1
        print(lv['id'], errs)
print('tango:', len(levels), 'levels, errors:', bad)
sys.exit(1 if bad else 0)
