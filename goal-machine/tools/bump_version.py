"""Bump the ?v= cache-busting number in index.html and the service worker cache name, so browsers and the
Android app pick up new files immediately. Run from the goal-machine folder."""
import re

html = open('index.html').read()
v = max(int(x) for x in re.findall(r'\?v=(\d+)', html)) + 1
open('index.html', 'w').write(re.sub(r'\?v=\d+', f'?v={v}', html))
sw = open('sw.js').read()
open('sw.js', 'w').write(re.sub(r"goal-machine-v\d+", f'goal-machine-v{v}', sw))
print(f'version -> {v}')
