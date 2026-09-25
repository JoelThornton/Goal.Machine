"""Sanity-check a freshly built players.js against the previous one before it gets published.
Usage: python check_data.py OLD.js NEW.js   (exit 1 = something looks wrong, don't publish)"""
import json, sys

def load(path):
    txt = open(path, encoding='utf-8').read()
    return json.loads(txt[txt.index('=') + 1:txt.rindex(';')])

old, new = load(sys.argv[1]), load(sys.argv[2])
problems = []
by_old = {(p[0], p[6]): p for p in old['players']}   # (name, first season)
by_new = {(p[0], p[6]): p for p in new['players']}

if len(new['players']) < 1900:
    problems.append(f"only {len(new['players'])} players")
if len(new['players']) < len(old['players']) - 10:
    problems.append(f"player count dropped {len(old['players'])} -> {len(new['players'])}")
shearer = next((p for p in new['players'] if p[0] == 'Alan Shearer'), None)
if not shearer or shearer[5] != 260 or shearer[4] != 441:
    problems.append('Alan Shearer is no longer 441 apps / 260 goals')
missing = [k for k in by_old if k not in by_new]
if len(missing) > 10:
    problems.append(f'{len(missing)} players disappeared, e.g. {missing[:5]}')
went_down = [(k[0], by_old[k][5], by_new[k][5]) for k in by_old if k in by_new and by_new[k][5] < by_old[k][5] - 1]
if len(went_down) > 5:
    problems.append(f'{len(went_down)} players lost goals, e.g. {went_down[:5]}')
tot = lambda d, i: sum(p[i] for p in d['players'])
if tot(new, 4) < tot(old, 4) * 0.99:
    problems.append('total appearances went down')

added = [k[0] for k in by_new if k not in by_old]
print(f"players {len(old['players'])} -> {len(new['players'])}, new: {added[:20]}")
print(f"total goals {tot(old, 5)} -> {tot(new, 5)}, apps {tot(old, 4)} -> {tot(new, 4)}, data up to {new['generated']}")
if problems:
    print('PROBLEMS:\n- ' + '\n- '.join(problems))
    sys.exit(1)
print('looks good')
