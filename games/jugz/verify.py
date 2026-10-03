# Independent check of levels.json: shape, ids, and that opt is the true minimum number of pours
# (a separate breadth-first search in Python, not the JS solver). Run: python3 games/jugz/verify.py
import json, os, sys
from collections import deque

levels = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'levels.json')))


def min_pours(caps, goal):
    start = (caps[0], 0, 0)
    seen = {start: 0}
    q = deque([start])
    while q:
        s = q.popleft()
        if goal in s:
            return seen[s]
        for i in range(3):
            for j in range(3):
                if i == j or s[i] == 0:
                    continue
                amt = min(s[i], caps[j] - s[j])
                if amt <= 0:
                    continue
                n = list(s); n[i] -= amt; n[j] += amt; n = tuple(n)
                if n not in seen:
                    seen[n] = seen[s] + 1
                    q.append(n)
    return None


bad = 0
seen_puzzles = set()
for k, lv in enumerate(levels):
    errs = []
    caps, goal, opt = lv['caps'], lv['goal'], lv['opt']
    if lv['id'] != k + 1:
        errs.append('id out of order')
    if len(caps) != 3 or not caps[0] > caps[1] > caps[2] > 0:
        errs.append('capacities must be three, strictly falling')
    if not 0 < goal < caps[0]:
        errs.append('goal out of range')
    m = min_pours(caps, goal)
    if m != opt:
        errs.append(f'opt is {opt}, the minimum is {m}')
    p = (tuple(caps), goal)
    if p in seen_puzzles:
        errs.append('duplicate puzzle')
    seen_puzzles.add(p)
    if errs:
        bad += 1
        print(lv['id'], errs)
print('jugz:', len(levels), 'levels, errors:', bad)
sys.exit(1 if bad else 0)
