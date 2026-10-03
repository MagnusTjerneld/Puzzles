# Independent check of levels.json: exactly one solution (brute force), connected regions, a valid stored solution.
# Run: python3 games/queens/verify.py
import json, itertools, sys
import os
levels = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')))
bad = 0
def count(n, grid):
    # brute force over column permutations (independent of the JS code)
    c = 0
    for perm in itertools.permutations(range(n)):
        if any(abs(perm[r]-perm[r+1]) <= 1 for r in range(n-1)): continue
        if len({grid[r*n+perm[r]] for r in range(n)}) != n: continue
        c += 1
        if c > 1: break
    return c
for lv in levels:
    n, g, sol = lv['n'], lv['grid'], lv['solution']
    errs = []
    if len(g) != n*n: errs.append('wrong size')
    if len(set(g)) != n: errs.append('wrong number of regions')
    # connected regions
    for reg in set(g):
        cells = {i for i in range(n*n) if g[i]==reg}
        st=[next(iter(cells))]; seen={st[0]}
        while st:
            x=st.pop(); r,c=divmod(x,n)
            for dr,dc in((1,0),(-1,0),(0,1),(0,-1)):
                rr,cc=r+dr,c+dc
                y=rr*n+cc
                if 0<=rr<n and 0<=cc<n and y in cells and y not in seen: seen.add(y); st.append(y)
        if seen!=cells: errs.append(f'region {reg} not connected')
    # stored solution valid
    if sorted(sol)!=list(range(n)): errs.append('solution not a permutation')
    if any(abs(sol[r]-sol[r+1])<=1 for r in range(n-1)): errs.append('queens touch')
    if len({g[r*n+sol[r]] for r in range(n)})!=n: errs.append('solution breaks the region rule')
    if count(n,g)!=1: errs.append('not exactly one solution')
    if errs: bad+=1; print(lv['id'], errs)
print('queens:', len(levels), 'levels, errors:', bad)
sys.exit(1 if bad else 0)
