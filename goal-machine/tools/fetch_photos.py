"""Finds faces for players the Premier League (FPL) and Transfermarkt data have no photo for.

1. premierleague.com: the site keeps headshots of many older players too. The epl-stats data gives each player's
   premierleague.com id; the site's API turns that into the photo code the app already uses for FPL players.
2. Wikipedia: the lead image of the player's article, only when the article is clearly him (a footballer who
   played for one of his clubs, born at a sensible age) and the file is freely licensed on Wikimedia Commons.
   These need crediting, so the author and licence are kept and listed on the in-game Photo credits page.

Writes data/photos.js (loaded by the page) and data/photos_checked.json (who was looked up and when, so the weekly
run only retries misses every couple of months). Needs SRC pointing at the fetched sources (for epl-stats).
Usage: SRC=src python tools/fetch_photos.py [max players to look up]
"""
import csv, datetime, html, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, OUT, CHECKED = ROOT / 'data/players.js', ROOT / 'data/photos.js', ROOT / 'data/photos_checked.json'
SRC = os.environ.get('SRC', 'src')
UA = 'GoalMachinePhotos/1.0 (https://opportunisticgames.github.io/goal-machine/; fan-made quiz game)'
PL_PHOTO = 'https://resources.premierleague.com/premierleague/photos/players/110x140/p{}.png'
RETRY_DAYS = 60
TODAY = datetime.date.today()
FREE = re.compile(r'^(cc0|cc[ -]by(-sa)?[ -]?[\d.]*( [a-z]+)?|public domain|pd\b.*)$', re.I)
# first words too common to identify a club on their own
AMBIG = {'manchester', 'west', 'sheffield', 'queens', 'crystal', 'aston', 'nottingham', 'wolverhampton', 'brighton',
         'bristol', 'swansea', 'hull', 'stoke', 'norwich', 'leicester', 'birmingham', 'derby', 'coventry', 'cardiff'}


def fold(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def get(url, headers=None, method='GET', tries=3):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, **(headers or {})})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read() if method == 'GET' else b''
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410):
                return e.code, b''
        except Exception:
            pass
        time.sleep(1 + 2 * i)
    return 0, b''


def get_json(url, headers=None):
    st, body = get(url, headers)
    try:
        return json.loads(body) if st == 200 else None
    except ValueError:
        return None


def load_players():
    s = DATA.read_text()
    d = json.loads(s[s.index('=') + 1:s.rindex(';')])
    return [dict(name=r[0], clubs=[d['clubs'][c] for c in r[3]], first=r[6], last=r[7], code=r[8],
                 tm=r[12] if len(r) > 12 else '') for r in d['players']]


def key(p):
    return f"{p['name']}|{p['first']}"


# ------------------------------------------------------------------ premierleague.com
def pl_index():
    idx = {}
    path = Path(SRC) / 'epl-stats/data/all.csv'
    if not path.exists():
        print('no epl-stats at', path, file=sys.stderr)
        return idx
    for row in csv.DictReader(path.open(encoding='utf-8')):
        years = [int(y[:4]) for y in re.findall(r'\d{4}/\d{4}', row['seasons'])]
        if years:
            idx.setdefault(fold(row['name']), []).append((int(row['id']), min(years), max(years)))
    return idx


def from_pl(p, idx):
    for pid, a, b in idx.get(fold(p['name']), []):
        if a > p['last'] or b < p['first']:
            continue
        st, body = get(f'https://footballapi.pulselive.com/football/players/{pid}',
                       {'Origin': 'https://www.premierleague.com', 'Referer': 'https://www.premierleague.com/'})
        m = re.search(rb'"opta"\s*:\s*"?p?(\d+)', body) if st == 200 else None
        if not m:
            continue
        code = int(m.group(1))
        st, _ = get(PL_PHOTO.format(code), method='HEAD')
        if st == 200:
            return {'pl': code}
    return None


# ------------------------------------------------------------------ Wikipedia / Commons
WAPI = 'https://en.wikipedia.org/w/api.php?'
CAPI = 'https://commons.wikimedia.org/w/api.php?'


def club_tests(clubs):
    tests = []
    for c in clubs:
        c = c.replace('&', 'and')
        tests.append(fold(c))
        w = fold(c).split()[0]
        if w not in AMBIG and len(w) > 3:
            tests.append(w)
    return tests


def from_wikipedia(p):
    surname = fold(p['name']).split()[-1]
    q = f"{p['name']} footballer {p['clubs'][0]}"
    res = get_json(WAPI + urllib.parse.urlencode({'action': 'query', 'list': 'search', 'srsearch': q, 'srlimit': 5, 'format': 'json'}))
    titles = [x['title'] for x in (res or {}).get('query', {}).get('search', []) if surname in fold(x['title'])]
    if not titles:
        return None
    info = get_json(WAPI + urllib.parse.urlencode({
        'action': 'query', 'titles': '|'.join(titles[:4]), 'prop': 'pageimages|description|extracts', 'piprop': 'name',
        'exintro': 1, 'explaintext': 1, 'exlimit': 'max', 'redirects': 1, 'format': 'json'}))
    pages = sorted((info or {}).get('query', {}).get('pages', {}).values(), key=lambda x: titles.index(x['title']) if x['title'] in titles else 9)
    tests = club_tests(p['clubs'])
    for pg in pages:
        text = fold(pg.get('extract', ''))
        if 'football' not in fold(pg.get('description', '')) + ' ' + text[:300] or not pg.get('pageimage'):
            continue
        if not any(t in text for t in tests):
            continue
        born = re.search(r'born[^)]{0,40}?\b(19\d\d|20\d\d)\b', pg.get('extract', '')[:400])
        if born and not (15 <= p['first'] - int(born.group(1)) <= 40):
            continue
        img = get_json(CAPI + urllib.parse.urlencode({
            'action': 'query', 'titles': 'File:' + pg['pageimage'], 'prop': 'imageinfo', 'iiprop': 'url|extmetadata',
            'iiurlwidth': 220, 'format': 'json'}))
        page = next(iter((img or {}).get('query', {}).get('pages', {}).values()), {})
        ii = (page.get('imageinfo') or [None])[0]
        if not ii:
            continue  # not on Commons (e.g. a non-free local file)
        meta = ii.get('extmetadata', {})
        lic = meta.get('LicenseShortName', {}).get('value', '')
        if not FREE.match(lic.strip()) or re.search(r'\bN[CD]\b', lic):
            continue
        artist = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', 'Unknown')))).strip()
        return {'w': ii['thumburl'], 'a': artist[:80] or 'Unknown', 'l': lic, 'u': ii['descriptionurl'], 't': pg['title']}
    return None


# ------------------------------------------------------------------ main
def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10 ** 9
    players = load_players()
    photos = {}
    if OUT.exists():
        s = OUT.read_text()
        photos = json.loads(s[s.index('=') + 1:s.rindex(';')])
    checked = json.loads(CHECKED.read_text()) if CHECKED.exists() else {}
    keys = {key(p) for p in players}
    photos = {k: v for k, v in photos.items() if k in keys}  # forget players who dropped out of the data
    idx = pl_index()
    todo = [p for p in players if not p['code'] and key(p) not in photos
            and (key(p) not in checked or (TODAY - datetime.date.fromisoformat(checked[key(p)])).days >= RETRY_DAYS)]
    todo.sort(key=lambda p: -(p['last'] - p['first']))  # longer careers (better known) first
    print(f'{len(todo)} players to look up (limit {limit})', file=sys.stderr)
    found = {'pl': 0, 'w': 0}
    for n, p in enumerate(todo[:limit]):
        hit = from_pl(p, idx) or from_wikipedia(p)
        if hit:
            photos[key(p)] = hit
            found['pl' if 'pl' in hit else 'w'] += 1
            checked.pop(key(p), None)
        else:
            checked[key(p)] = TODAY.isoformat()
        if n % 50 == 0:
            print(f'  {n}/{len(todo)} found so far {found}', file=sys.stderr)
        time.sleep(0.2)
    OUT.write_text('// Generated by tools/fetch_photos.py - extra player photos (premierleague.com / Wikimedia Commons)\n'
                   'window.GM_PHOTOS=' + json.dumps(dict(sorted(photos.items())), ensure_ascii=False, separators=(',', ':')) + ';\n')
    CHECKED.write_text(json.dumps(dict(sorted(checked.items())), indent=0) + '\n')
    print(f'found {found}; {len(photos)} extra photos in total; no photo yet for {len(checked)}', file=sys.stderr)


if __name__ == '__main__':
    main()
