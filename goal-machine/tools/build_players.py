"""Build a Premier League all-time player dataset (apps, goals, clubs, position, nationality).

Sources:
  epl-stats   (premierleague.com scrape, all players with PL id <= 5100, complete up to March 2020 / GW29 of 2019-20)
  vaastav FPL (gameweek-level data 2016-17 -> today, plus FPL history_past season totals back to 2006/07)
  understat   (season totals 2014-15 -> 2021-22)
  transfermarkt profiles (nationality for players missing it)
"""
import ast, collections, glob, json, math, os, re, sys, unicodedata
import pandas as pd

# Directory holding the cloned sources (see README): epl-stats/, fpl/, us/, football-datasets/
S = os.environ.get('SRC', os.path.dirname(os.path.abspath(__file__)))
FPL = f'{S}/fpl/data'
MIN_APPS = int(sys.argv[1]) if len(sys.argv) > 1 else 50

def norm(s):
    s = str(s).replace('&#039;', "'")
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('ø', 'o').replace('æ', 'ae').replace('ß', 'ss').replace('ı', 'i').replace('ł', 'l').replace('đ', 'd')
    s = re.sub(r"[^a-z ]", ' ', s.replace("'", ''))
    return re.sub(r'\s+', ' ', s).strip()

def toks(s):
    return set(norm(s).split())

CANON = {
    'Bournemouth': 'AFC Bournemouth', 'Brighton': 'Brighton and Hove Albion', 'Man City': 'Manchester City',
    'Man Utd': 'Manchester United', 'Newcastle': 'Newcastle United', 'Norwich': 'Norwich City',
    "Nott'm Forest": 'Nottingham Forest', 'Sheffield Utd': 'Sheffield United', 'Spurs': 'Tottenham Hotspur',
    'Tottenham': 'Tottenham Hotspur', 'West Brom': 'West Bromwich Albion', 'West Ham': 'West Ham United',
    'Wolves': 'Wolverhampton Wanderers', 'Leicester': 'Leicester City', 'Leeds': 'Leeds United',
    'Luton': 'Luton Town', 'Ipswich': 'Ipswich Town', 'Cardiff': 'Cardiff City', 'Huddersfield': 'Huddersfield Town',
    'Hull': 'Hull City', 'Stoke': 'Stoke City', 'Swansea': 'Swansea City', 'Brentford': 'Brentford',
}
def canon(t):
    t = re.sub(r'\(Loan\)', '', t).strip()
    return CANON.get(t, t)

def season_key(y):  # 2019 -> '2019/2020'
    return f'{y}/{y+1}'

# ---------------------------------------------------------------- epl-stats
E = pd.read_csv(f'{S}/epl-stats/data/all.csv')
epl = {}
for r in E.itertuples():
    clubs = []
    for c in ast.literal_eval(r.clubs):
        c = canon(c)
        if c not in clubs:
            clubs.append(c)
    seasons = sorted(ast.literal_eval(r.seasons))
    epl[r.id] = dict(name=r.name.strip(), pos=r.position, nat=r.nationality if isinstance(r.nationality, str) else None, clubs=clubs[::-1],
                     seasons=set(seasons), apps=int(r.apps), goals=int(r.goals), ast=int(r.assists))

# ---------------------------------------------------------------- understat
US = {}  # season start year -> DataFrame
for f in glob.glob(f'{S}/us/datasets/epl/players_epl_*.csv'):
    y = 2000 + int(re.search(r'_(\d\d)-\d\d', f).group(1))
    d = pd.read_csv(f)
    d['player_name'] = d.player_name.str.replace('&#039;', "'")
    US[y] = d

# ---------------------------------------------------------------- FPL
fpl_names = collections.defaultdict(set)   # code -> name variants
fpl_disp = {}                               # code -> display name (latest season wins)
fpl_pos = collections.defaultdict(collections.Counter)
fpl_birth = {}
fpl_seasons = collections.defaultdict(dict) # code -> {year: dict(apps, goals, mins, teams)}
hist = collections.defaultdict(dict)        # code -> {year: (mins, goals)}
hist_ast = collections.defaultdict(dict)    # code -> {year: assists}
teams_by_season = collections.defaultdict(dict)  # code -> {year: [clubs]} (exact, FPL era)
POS = {1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward'}

def fpl_display(r):
    kn = getattr(r, 'known_name', None)
    if isinstance(kn, str) and kn.strip():
        return kn.strip()
    first, second, web = r.first_name.strip(), r.second_name.strip(), str(r.web_name).strip()
    if '.' in web:
        web = web.split('.')[-1].strip()
    ft, st, wt = norm(first).split(), norm(second).split(), norm(web).split()
    if len(ft) == 1 and len(st) == 1:
        return f'{first} {second}'
    if wt and ft and wt[0] == ft[0] and len(wt) > 1:
        return web
    if len(wt) == 1 and wt[0] in ft:
        return web  # mononym, e.g. Kenedy / Fernandinho style
    if not set(wt) <= set(ft + st):
        return web
    return f'{first.split()[0]} {web}'

team_names = {}
LATEST_MATCH = ''  # date of the newest match in the data - stamps the output so unchanged data gives an identical file
for sdir in sorted(glob.glob(f'{FPL}/20*')):
    y = int(os.path.basename(sdir)[:4])
    raw = pd.read_csv(f'{sdir}/players_raw.csv')
    el2code = dict(zip(raw.id, raw.code))
    for r in raw.itertuples():
        fpl_names[r.code] |= {f'{r.first_name} {r.second_name}', str(r.web_name)}
        if isinstance(getattr(r, 'known_name', None), str):
            fpl_names[r.code].add(r.known_name)
        fpl_disp[r.code] = fpl_display(r)
        fpl_pos[r.code][POS.get(r.element_type, 'Midfielder')] += 3 if y >= 2024 else 1
        if isinstance(getattr(r, 'birth_date', None), str):
            fpl_birth[r.code] = r.birth_date
    # team ids -> names
    if os.path.exists(f'{sdir}/teams.csv'):
        t = pd.read_csv(f'{sdir}/teams.csv')
        tn = {i: canon(n) for i, n in zip(t.id, t.name)}
    else:
        tn = None
    g = pd.read_csv(f'{sdir}/gws/merged_gw.csv', encoding='latin1', low_memory=False)
    g = g[g.element.isin(el2code)]
    LATEST_MATCH = max(LATEST_MATCH, str(g.kickoff_time.max())[:10])
    # derive each row's team from fixture: player's team = the other opponent_team seen in that fixture
    fx = g.groupby('fixture').opponent_team.unique().to_dict()
    def own_team(row_fix, opp):
        s = [t for t in fx[row_fix] if t != opp]
        return s[0] if s else None
    g['team_id'] = [own_team(f, o) for f, o in zip(g.fixture, g.opponent_team)]
    if tn is None:
        # infer team names by majority vote against understat team of the same season
        u = US[y]
        votes = collections.defaultdict(collections.Counter)
        ukey = {norm(n): tt for n, tt in zip(u.player_name, u.team_title)}
        for r in raw.itertuples():
            for nm in (f'{r.first_name} {r.second_name}', r.web_name):
                if norm(nm) in ukey:
                    votes[r.team][ukey[norm(nm)].split(',')[-1]] += 1
                    break
        tn = {tid: canon(v.most_common(1)[0][0]) for tid, v in votes.items()}
        # map team ids seen via fixtures (these equal raw.team ids)
    team_names[y] = tn
    if y == 2019:  # epl-stats already covers GW1-29 of 2019-20
        g_post = g[g.GW >= 30]
    else:
        g_post = g
    for (el), d in g.groupby('element'):
        code = el2code[el]
        played = d[d.minutes > 0]
        dp = g_post[(g_post.element == el) & (g_post.minutes > 0)] if y == 2019 else played
        teams = []
        for tid in played.sort_values('kickoff_time').team_id:
            nm = tn.get(tid)
            if nm and nm not in teams:
                teams.append(nm)
        teams_by_season[code][y] = teams
        fpl_seasons[code][y] = dict(apps=len(played), goals=int(played.goals_scored.sum()),
                                    ast=int(played.assists.sum()), ast_post=int(dp.assists.sum()),
                                    mins=int(played.minutes.sum()), teams=teams,
                                    apps_post=len(dp), goals_post=int(dp.goals_scored.sum()),
                                    apps_pre=len(played) - len(dp), goals_pre=int(played.goals_scored.sum() - dp.goals_scored.sum()))
    # history_past
    for hf in glob.glob(f'{sdir}/players/*/history.csv'):
        try:
            h = pd.read_csv(hf)
        except Exception:
            continue
        if 'element_code' not in h:
            continue
        for r in h.itertuples():
            hy = int(str(r.season_name)[:4])
            hist[r.element_code][hy] = (int(r.minutes), int(r.goals_scored))
            hist_ast[r.element_code][hy] = int(r.assists)

print('FPL codes', len(fpl_seasons), 'with history', len(hist), file=sys.stderr)

# ---------------------------------------------------------------- link understat ids -> FPL codes
us_to_code = {}
code_to_us = {}
for y, u in US.items():
    if y < 2016:
        continue
    by_team_goals = collections.defaultdict(list)
    for code, ss in fpl_seasons.items():
        if y in ss and ss[y]['apps'] > 0:
            for t in ss[y]['teams'] or [None]:
                by_team_goals[(t, ss[y]['goals'])].append(code)
    for r in u.itertuples():
        if r.id in us_to_code:
            continue
        cands = set()
        for t in r.team_title.split(','):
            cands |= set(by_team_goals.get((canon(t), r.goals), []))
        best = None
        for code in cands:
            ss = fpl_seasons[code][y]
            if abs(ss['mins'] - r.time) > max(120, 0.08 * r.time):
                continue
            ut = toks(r.player_name)
            if any(ut & toks(n) for n in fpl_names[code]):
                best = code
                break
        if best:
            us_to_code[r.id] = best
            code_to_us[best] = r.id
print('understat linked', len(us_to_code), file=sys.stderr)

# ---------------------------------------------------------------- link FPL codes -> epl-stats ids
epl_by_last = collections.defaultdict(list)
for eid, p in epl.items():
    for t in toks(p['name']):
        epl_by_last[t].append(eid)

def played_years(code):
    ys = {y for y, (m, g) in hist[code].items() if m > 0 and y < 2016}
    for y, s in fpl_seasons[code].items():
        if (y < 2019 and s['apps'] > 0) or (y == 2019 and s['apps_pre'] > 0):
            ys.add(y)
    return ys

def name_score(ename, code):
    et = toks(ename)
    elast = norm(ename).split()[-1] if norm(ename) else ''
    best = 0
    for n in fpl_names[code]:
        nt = toks(n)
        if not nt:
            continue
        if norm(n) == norm(ename):
            return 10
        if elast not in nt and not (nt <= et):
            continue
        inter = len(et & nt)
        if inter:
            best = max(best, inter / len(et | nt) * 5 + (2 if et <= nt or nt <= et else 0))
    return best

def fpl_goals_until_cutoff(code, since):
    g = sum(gl for y, (m, gl) in hist[code].items() if since <= y < 2016)
    for y, s in fpl_seasons[code].items():
        if 2016 <= y < 2019:
            g += s['goals']
        elif y == 2019:
            g += s['goals_pre']
    return g

pairs = []
for code in fpl_seasons:
    ys = played_years(code)
    if not ys:
        continue
    cands = set()
    for n in fpl_names[code]:
        for t in toks(n):
            if len(t) > 2:
                cands |= set(epl_by_last.get(t, []))
    for eid in cands:
        es = epl[eid]['seasons']
        if not {season_key(y) for y in ys} <= es:
            continue
        sc = name_score(epl[eid]['name'], code)
        if sc < 2:
            continue
        first = min(int(x[:4]) for x in es)
        fg = fpl_goals_until_cutoff(code, 0)
        eg = epl[eid]['goals']
        if first >= 2006:
            sc += 5 if abs(fg - eg) <= 1 else (0 if abs(fg - eg) <= max(3, 0.1 * eg) else -20)
        elif fg > eg + max(3, 0.1 * eg):
            sc -= 20
        if sc > 0:
            pairs.append((sc, code, eid))
pairs.sort(reverse=True)
code_to_epl, taken = {}, set()
for sc, code, eid in pairs:
    if code in code_to_epl or eid in taken:
        continue
    code_to_epl[code] = eid
    taken.add(eid)
print('FPL->epl linked', len(code_to_epl), file=sys.stderr)
# report FPL players that played before the cutoff but found no epl-stats match
unl = [(fpl_disp[c], sorted(played_years(c))) for c in fpl_seasons if c not in code_to_epl and played_years(c)]
print('unlinked pre-2020 FPL players', len(unl), file=sys.stderr)
json.dump(unl, open(os.environ.get('UNLINKED', '/dev/null'), 'w'), ensure_ascii=False)

# ---------------------------------------------------------------- assemble
players = []
def add(name, pos, nat, clubs, apps, goals, first, last, code=None, approx=False, src='', ast=0, stints=None):
    players.append(dict(name=name, pos=pos, nat=nat, clubs=clubs, apps=apps, goals=goals, ast=ast,
                        first=first, last=last, code=code, approx=approx, src=src, stints=stints or {}))

linked_epl = {e: c for c, e in code_to_epl.items()}
for eid, p in epl.items():
    code = linked_epl.get(eid)
    apps, goals, ast, clubs = p['apps'], p['goals'], p['ast'], list(p['clubs'])
    yrs = [int(s[:4]) for s in p['seasons']]
    if not yrs:
        continue
    last = max(yrs)
    stints = collections.defaultdict(set)
    if len(p['clubs']) == 1:  # one-club career: every season was at that club
        stints[p['clubs'][0]] |= set(yrs)
    if code in code_to_us:
        for y in (2014, 2015):
            row = US[y][US[y].id == code_to_us[code]]
            for t in (row.iloc[0].team_title.split(',') if len(row) else []):
                stints[canon(t)].add(y)
    if code:
        for y, s in sorted(fpl_seasons[code].items()):
            for t in s['teams']:
                stints[t].add(y)
            if y < 2019:
                continue
            a, g, x = (s['apps_post'], s['goals_post'], s['ast_post']) if y == 2019 else (s['apps'], s['goals'], s['ast'])
            apps += a; goals += g; ast += x
            if s['apps']:
                last = max(last, y)
            for t in s['teams']:
                if t not in clubs:
                    clubs.append(t)
    pos = p['pos'] if p['pos'] in ('Goalkeeper', 'Defender', 'Midfielder', 'Forward') else (
        fpl_pos[code].most_common(1)[0][0] if code else 'Midfielder')
    first_played = min(yrs)
    add(p['name'], pos, p['nat'], clubs, apps, goals, first_played, last, code, src='epl', ast=ast, stints=stints)

for code, ss in fpl_seasons.items():
    if code in code_to_epl:
        continue
    usid = code_to_us.get(code)
    apps = goals = 0
    clubs = []
    per = {}   # year -> (apps, goals, approx, teams, assists)
    for y, s in ss.items():
        if s['apps']:
            per[y] = (s['apps'], s['goals'], False, s['teams'], s['ast'])
    # understat 2014-15 / 2015-16
    if usid is not None:
        for y in (2014, 2015):
            u = US[y]
            row = u[u.id == usid]
            if len(row):
                r = row.iloc[0]
                per[y] = (int(r.games), int(r.goals), False, [canon(t) for t in r.team_title.split(',')], int(r.assists))
    # minutes-per-app ratio for estimating history-only seasons
    known_m = sum(s['mins'] for s in ss.values())
    known_a = sum(s['apps'] for s in ss.values())
    ratio = min(90, max(45, known_m / known_a)) if known_a else 75
    for y, (m, g) in hist[code].items():
        if y in per or m <= 0 or y >= 2016:
            continue
        per[y] = (max(1, round(m / ratio)), g, True, [], hist_ast[code].get(y, 0))
    if not per:
        continue
    ast = 0
    stints = collections.defaultdict(set)
    for y in sorted(per):
        a, g, ap, teams, x = per[y]
        apps += a; goals += g; ast += x
        for t in teams:
            stints[t].add(y)
            if t not in clubs:
                clubs.append(t)
    approx = any(v[2] for v in per.values())
    add(fpl_disp[code], fpl_pos[code].most_common(1)[0][0], None, clubs, apps, goals, min(per), max(per), code, approx,
        src='fpl', ast=ast, stints=stints)

# understat-only players (left PL before 2016-17 and missing from epl-stats)
epl_names = {norm(p['name']) for p in epl.values()}
us_only = collections.defaultdict(lambda: dict(apps=0, goals=0, ast=0, clubs=[], years=[], name=None, pos=None, stints=collections.defaultdict(set)))
for y, u in US.items():
    for r in u.itertuples():
        if r.id in us_to_code or norm(r.player_name) in epl_names:
            continue
        d = us_only[r.id]
        if y >= 2016:
            d['skip'] = True
        d['apps'] += int(r.games); d['goals'] += int(r.goals); d['ast'] += int(r.assists); d['years'].append(y)
        for t in r.team_title.split(','):
            d['stints'][canon(t)].add(y)
        d['name'] = r.player_name; d['pos'] = r.position
        for t in r.team_title.split(','):
            if canon(t) not in d['clubs']:
                d['clubs'].append(canon(t))
UPOS = {'G': 'Goalkeeper', 'D': 'Defender', 'M': 'Midfielder', 'F': 'Forward'}
for uid, d in us_only.items():
    if d.get('skip') or d['apps'] < MIN_APPS:
        continue
    add(d['name'], UPOS.get(d['pos'][0], 'Midfielder'), None, d['clubs'], d['apps'], d['goals'],
        min(d['years']), max(d['years']), approx=True, src='understat', ast=d['ast'], stints=d['stints'])

# ---------------------------------------------------------------- nationality via transfermarkt
TM = pd.read_csv(f'{S}/football-datasets/datalake/transfermarkt/player_profiles/player_profiles.csv', low_memory=False,
                 usecols=['player_name', 'date_of_birth', 'citizenship', 'current_club_name', 'second_club_name'])
TM['n'] = TM.player_name.str.replace(r'\s*\(\d+\)$', '', regex=True).map(norm)
tm_by_name = collections.defaultdict(list)
for r in TM.itertuples():
    tm_by_name[r.n].append(r)
code_all_names = fpl_names
fixed = 0
for p in players:
    if p['nat']:
        continue
    cands = []
    names = {p['name']} | (code_all_names[p['code']] if p['code'] else set())
    for n in names:
        cands += tm_by_name.get(norm(n), [])
    cands = list({id(c): c for c in cands}.values())
    b = fpl_birth.get(p['code'])
    if b:
        exact = [c for c in cands if str(c.date_of_birth)[:10] == b]
        if exact:
            cands = exact
    if len({str(c.citizenship) for c in cands}) == 1:
        nat = str(cands[0].citizenship)
    else:
        eng = [c for c in cands if any(k in str(c.current_club_name) + str(c.second_club_name)
               for k in ('FC', 'Town', 'City', 'United', 'Rovers', 'Albion', 'Villa', 'Palace', 'Hotspur'))]
        nat = str(eng[0].citizenship) if len(eng) == 1 else None
    if nat and nat != 'nan':
        p['nat'] = nat.split('  ')[0].strip()
        fixed += 1
print('nationalities from TM', fixed, 'still missing', sum(1 for p in players if not p['nat']), file=sys.stderr)

NAT_FIX = {'Korea, South': 'South Korea', "Cote d'Ivoire": 'Ivory Coast', "Côte d'Ivoire": 'Ivory Coast',
           'Republic of Ireland': 'Ireland', 'Congo DR': 'DR Congo', 'Türkiye': 'Turkey', 'Czechia': 'Czech Republic',
           'Bosnia-Herzegovina': 'Bosnia and Herzegovina', 'The Gambia': 'Gambia', 'Northern Ireland': 'Northern Ireland'}
for p in players:
    if p['nat']:
        p['nat'] = NAT_FIX.get(p['nat'], p['nat'])

NAME_FIX = {'Virgil': 'Virgil van Dijk', 'Raúl': 'Raúl Jiménez', 'Diogo': 'Diogo Jota', 'Andreas': 'Andreas Pereira',
            'Darwin': 'Darwin Núñez', 'Royal': 'Emerson Royal', 'Ricardo': 'Ricardo Pereira', 'Ederson': 'Ederson',
            'Jan Van Hecke': 'Jan Paul van Hecke', 'Micky Van de Ven': 'Micky van de Ven', 'Sepp Van den Berg': 'Sepp van den Berg',
            'Bobby De Cordova-Reid': 'Bobby Decordova-Reid', 'Ahmed El Mohamady': 'Ahmed Elmohamady'}
for p in players:
    p['name'] = NAME_FIX.get(p['name'].strip(), p['name'].strip())
    if p['nat']:
        n = p['nat'].title().replace(' And ', ' and ').replace(' Of ', ' of ')
        n = {"Cote D'Ivoire": 'Ivory Coast', 'The Democratic Republic of Congo': 'DR Congo', 'Usa': 'United States', 'Dr Congo': 'DR Congo'}.get(n, n)
        p['nat'] = n

NAT_MANUAL = {"N'Golo Kanté": 'France', 'Cédric': 'Portugal', 'Fabinho': 'Brazil', 'Daryl Janmaat': 'Netherlands',
    'Vitalii Mykolenko': 'Ukraine', 'Davinson Sánchez': 'Colombia', 'Simon Francis': 'England', 'José Holebas': 'Greece',
    'Thiago Silva': 'Brazil', 'Ricardo Pereira': 'Portugal', 'Paquetá': 'Brazil', 'Jonathan Otto': 'Spain',
    'Çaglar Söyüncü': 'Turkey', "Dara O'Shea": 'Ireland', 'Yehor Yarmoliuk': 'Ukraine', 'Darwin Núñez': 'Uruguay',
    'Allan-Roméo Nyom': 'Cameroon', 'Alberto Moreno': 'Spain', 'Yerry Mina': 'Colombia', 'Nicolas Pépé': 'Ivory Coast',
    'Illia Zabarnyi': 'Ukraine', 'Marcos Rojo': 'Argentina', 'Joselu': 'Spain', 'Ben Gibson': 'England',
    'Marc Pugh': 'England', 'Raphinha': 'Brazil', 'Bafétimbi Gomis': 'France', 'Ibrahima Diallo': 'France',
    'Diafra Sakho': 'Senegal', 'Đorđe Petrović': 'Serbia', 'Carlos Sánchez': 'Colombia', 'André-Frank Anguissa': 'Cameroon',
    "Jake O'Brien": 'Ireland', 'Laurent Depoitre': 'Belgium', 'Trézéguet': 'Egypt', 'Mykhailo Mudryk': 'Ukraine',
    'Diego Llorente': 'Spain', 'Tyler Roberts': 'Wales'}
for p in players:
    if not p['nat'] and p['name'] in NAT_MANUAL:
        p['nat'] = NAT_MANUAL[p['name']]

# ---------------------------------------------------------------- secondary positions
# The sources only give one position, so versatility comes from FPL position changes, simple
# stat rules (goalscoring midfielders can play up top, low-scoring forwards are usually wingers)
# and a hand-picked list of famous utility men.
L = {'Goalkeeper': 'G', 'Defender': 'D', 'Midfielder': 'M', 'Forward': 'F'}
EXTRA_POS = {
    'Dion Dublin': 'D', 'Gareth Bale': 'DF', 'James Milner': 'D', 'Chris Sutton': 'D', 'Phil Neville': 'M',
    "John O'Shea": 'M', 'Ashley Young': 'DF', 'Luis Antonio Valencia': 'M', 'Victor Moses': 'D', 'Michail Antonio': 'DF',
    'Trent Alexander-Arnold': 'M', 'Oleksandr Zinchenko': 'M', 'Fernandinho': 'D', 'Eric Dier': 'DM', 'Emre Can': 'D',
    'Wayne Rooney': 'M', 'Paul Scholes': 'F', 'Ryan Giggs': 'F', 'Tim Cahill': 'F', 'Marouane Fellaini': 'F',
    'Kevin Nolan': 'F', 'Steven Gerrard': 'F', 'Frank Lampard': 'F', 'David Luiz': 'M', 'Kieran Trippier': 'M',
    'Rodri': 'D', 'Declan Rice': 'D', 'John Stones': 'M', 'Rio Ferdinand': 'M', 'Fabinho': 'D', 'Carlos Tevez': 'M',
    'Kevin De Bruyne': 'F', 'Bernardo Silva': 'F', 'Phil Foden': 'F', 'Son Heung-Min': 'F', 'Mohamed Salah': 'F',
    'Sadio Mané': 'F', 'Raheem Sterling': 'F', 'Riyad Mahrez': 'F', 'Roberto Firmino': 'M', 'Dwight Yorke': 'M',
    'Teddy Sheringham': 'M', 'Dennis Bergkamp': 'M', 'Gianfranco Zola': 'M', 'Eric Cantona': 'M', 'Robbie Keane': 'M',
    'Jamie Carragher': 'M', 'Gary Neville': 'M', 'Javier Mascherano': 'D', 'Lucas Leiva': 'D', 'Jordan Henderson': 'D',
    'Joshua Kimmich': 'D', 'Joao Cancelo': 'M', 'Danny Murphy': 'F', 'Emile Heskey': 'M', 'Kyle Walker': 'M',
    'Ben White': 'M', 'Matthijs de Ligt': '', 'Richarlison': 'M', 'Kai Havertz': 'M', 'Leandro Trossard': 'F',
    'Jarrod Bowen': 'F', 'Bukayo Saka': 'F', 'Cole Palmer': 'F', 'Dominic Solanke': 'M', 'Nicolas Anelka': 'M',
    'Dimitar Berbatov': 'M', 'Juan Mata': 'F', 'Eden Hazard': 'F', 'Robert Pirès': 'F', 'Freddie Ljungberg': 'F',
    'Marc Overmars': 'F', 'David Ginola': 'F', 'Steve McManaman': 'F', 'Jesse Lingard': 'F', 'Andros Townsend': 'F',
}
def broad_extras(p):
    """Extra broad roles (D/M/F) from FPL listings, the curated list and a goalscoring-midfielder rule."""
    prim = L[p['pos']]
    ext = []
    if prim == 'G':
        return ext
    if p['code']:
        ext += [L[k] for k in fpl_pos[p['code']] if L[k] not in (prim, 'G')]
    if prim == 'M' and p['goals'] / max(1, p['apps']) >= 0.2 and p['goals'] >= 15:
        ext.append('F')
    ext += [x for x in EXTRA_POS.get(p['name'], '') if x != prim]
    return list(dict.fromkeys(ext))

# detailed positions: Transfermarkt profile -> GK LB CB RB LM CM RM ST
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from positions_manual import POSITIONS as MANUAL_POS
TM2 = pd.read_csv(f'{S}/football-datasets/datalake/transfermarkt/player_profiles/player_profiles.csv', low_memory=False,
                  usecols=['player_name', 'date_of_birth', 'citizenship', 'position', 'main_position'])
TM2['n'] = TM2.player_name.str.replace(r'\s*\(\d+\)$', '', regex=True).map(norm)
tm2 = collections.defaultdict(list)
for r in TM2.itertuples():
    tm2[r.n].append(r)
TM_DETAIL = {'Goalkeeper': 'GK', 'Centre-Back': 'CB', 'Sweeper': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB',
             'Defensive Midfield': 'CM', 'Central Midfield': 'CM', 'Attacking Midfield': 'CM', 'Left Midfield': 'LM',
             'Right Midfield': 'RM', 'Left Winger': 'LM', 'Right Winger': 'RM', 'Centre-Forward': 'ST',
             'Second Striker': 'ST', 'Defender': 'CB', 'Midfield': 'CM', 'Attack': 'ST'}
GROUP = {'GK': 'G', 'LB': 'D', 'CB': 'D', 'RB': 'D', 'LM': 'M', 'CM': 'M', 'RM': 'M', 'ST': 'F'}
DEFAULT = {'G': 'GK', 'D': 'CB', 'M': 'CM', 'F': 'ST'}
TM_BROAD = {'Goalkeeper': 'G', 'Defender': 'D', 'Midfield': 'M', 'Attack': 'F'}

def tm_match(p):
    names = {p['name']} | (fpl_names[p['code']] if p['code'] else set())
    c = list({id(x): x for n in names for x in tm2.get(norm(n), [])}.values())
    if p['nat']:
        c2 = [x for x in c if isinstance(x.citizenship, str) and p['nat'].lower().split()[0] in x.citizenship.lower()]
        c = c2 or c
    b = fpl_birth.get(p['code'])
    if b:
        c2 = [x for x in c if str(x.date_of_birth)[:10] == b]
        c = c2 or c
    def age_ok(x):
        try:
            return 15 <= p['first'] - int(str(x.date_of_birth)[:4]) <= 40
        except ValueError:
            return True
    c = [x for x in c if age_ok(x)]
    if len(c) > 1:
        prim = L[p['pos']]
        c = [x for x in c if TM_BROAD.get(x.main_position) == prim or (prim == 'M' and x.main_position == 'Attack')] or c
    return c[0] if len(c) == 1 else None

src_count = collections.Counter()
for p in players:
    prim = L[p['pos']]
    if prim == 'G':
        p['poss'] = 'GK'
        continue
    if p['name'] in MANUAL_POS:
        p['poss'] = '/'.join(MANUAL_POS[p['name']][:4])
        src_count['manual'] += 1
        continue
    ps = []
    m = tm_match(p) if prim != 'G' else None
    if m is not None and isinstance(m.position, str):
        d = TM_DETAIL.get(m.position.split(' - ')[-1].strip(), DEFAULT[prim])
        # trust the PL's own category for the primary role if Transfermarkt disagrees (late-career moves)
        ps = [d] if GROUP[d] == prim else [DEFAULT[prim], d]
        src_count['transfermarkt'] += 1
    else:
        ps = [DEFAULT[prim]]
        src_count['default'] += 1
        p['pos_default'] = True
    for x in broad_extras(p):
        if any(GROUP[q] == x for q in ps):
            continue
        if x == 'D':
            ps.append({'LM': 'LB', 'RM': 'RB'}.get(ps[0], 'CB'))
        elif x == 'M':
            ps.append({'LB': 'LM', 'RB': 'RM'}.get(ps[0], 'CM'))
        elif x == 'F':
            ps.append('ST')
    p['poss'] = '/'.join(list(dict.fromkeys(ps))[:4])
for p in players:
    p['pos'] = {'G': 'Goalkeeper', 'D': 'Defender', 'M': 'Midfielder', 'F': 'Forward'}[GROUP[p['poss'].split('/')[0]]]
print('detailed positions from', dict(src_count), file=sys.stderr)

# ---------------------------------------------------------------- output
out = [p for p in players if p['apps'] >= MIN_APPS]
out.sort(key=lambda p: (-p['apps'], p['name']))
print('players >=', MIN_APPS, 'apps:', len(out), 'by src', collections.Counter(p['src'] for p in out),
      'approx', sum(p['approx'] for p in out), file=sys.stderr)
json.dump(out, open(os.environ.get('FULL', f'{S}/players_full.json'), 'w'), ensure_ascii=False, indent=0, default=sorted)

# ---------------------------------------------------------------- club stints from transfers (ewenme/transfers)
# Every move in/out of Premier League and Championship clubs since 1992 lets us work out which club a player was
# at in each season - needed for "played together" chemistry and PL title badges.
club_norm = {}
for c in {c for p in out for c in p['clubs']}:
    club_norm[norm(c)] = c
def canon_tm_club(n):
    n0 = norm(re.sub(r'\b(FC|AFC)\b', '', n))
    for k, v in club_norm.items():
        if n0 == k or n0 == norm(re.sub(r'\b(FC|AFC)\b', '', v)):
            return v
    return {'brighton hove albion': 'Brighton and Hove Albion', 'wolverhampton wanderers': 'Wolverhampton Wanderers',
            'afc bournemouth': 'AFC Bournemouth', 'bournemouth': 'AFC Bournemouth'}.get(n0)
tr = pd.concat([pd.read_csv(f'{S}/transfers/data/{f}.csv') for f in ('premier-league', 'championship')])
tr['club'] = tr.club_name.map(canon_tm_club)
tr = tr[tr.club.notna()]
tr['y'] = tr.season.str[:4].astype(int)
tr['k'] = tr.player_name.map(norm)
events = collections.defaultdict(list)
by_surname = collections.defaultdict(list)   # (surname, first initial) -> events, for Andy/Andrew-style name mismatches
for r in tr.itertuples():
    e = (r.y, 0 if r.transfer_period == 'Summer' else 1, r.transfer_movement, r.club)
    events[r.k].append(e)
    parts = r.k.split()
    if len(parts) >= 2:
        by_surname[(parts[-1], parts[0][0])].append(e)
added = 0
for i, p in enumerate(out):
    keys = {norm(p['name'])} | ({norm(n) for n in fpl_names[p['code']]} if p['code'] else set())
    ok = lambda e: e[3] in p['clubs'] and p['first'] - 3 <= e[0] <= p['last'] + 1
    ev = sorted({e for k in keys for e in events.get(k, []) if ok(e)})
    if not ev:
        parts = norm(p['name']).split()
        if len(parts) >= 2:
            ev = sorted({e for e in by_surname.get((parts[-1], parts[0][0]), []) if ok(e)})
    if not ev:
        continue
    for club in {e[3] for e in ev}:
        ce = [e for e in ev if e[3] == club]
        start = None
        # an 'out' with no earlier 'in' means he was already there (youth product / pre-1992 signing) -
        # unless he'd been at other clubs before, in which case we only trust that one season
        if ce[0][2] == 'out':
            earlier_elsewhere = any(e[3] != club and e[2] == 'in' and e[:2] < ce[0][:2] for e in ev)
            start = ce[0][0] if earlier_elsewhere else p['first']
        prev = None
        for y, half, mv, _ in ce:
            if mv == 'in':
                if start is None:
                    start = y
            else:
                if start is None and prev is not None and prev[2] == 'out':
                    start = prev[0]  # two 'outs' in a row: the loan return wasn't recorded, so he came back
                if start is not None:
                    end = y - 1 if half == 0 else y
                    for yy in range(start, end + 1):
                        p['stints'].setdefault(club, set()).add(yy); added += 1
                    start = None
            prev = (y, half, mv)
        if start is not None:
            # no recorded exit: he stayed until he next joined another club (or the end of his PL career)
            last_in = max(e for e in ce if e[2] == 'in') if any(e[2] == 'in' for e in ce) else ce[0]
            later = [e for e in ev if e[3] != club and e[2] == 'in' and e[:2] > last_in[:2]]
            end = (later[0][0] - (1 if later[0][1] == 0 else 0)) if later else p['last']
            for yy in range(start, end + 1):
                p['stints'].setdefault(club, set()).add(yy); added += 1
    # never claim seasons outside his PL career
    for club in list(p['stints']):
        p['stints'][club] = {y for y in p['stints'][club] if p['first'] <= y <= p['last']}
        if not p['stints'][club]:
            del p['stints'][club]
print('stint seasons added from transfers', added, file=sys.stderr)

# ---------------------------------------------------------------- honours, titles, teammates
from honours import HALL_OF_FAME, GOLDEN_BOOT, WORLD_CUP, CHAMPIONS_LEAGUE, CHAMPIONS, names as hnames
by_norm = collections.defaultdict(list)
for i, p in enumerate(out):
    by_norm[norm(p['name'])].append(i)
    if p['code']:
        for n in fpl_names[p['code']]:
            by_norm[norm(n)].append(i)
def find(n):
    c = list(dict.fromkeys(by_norm.get(norm(n), [])))
    return c
missing = []
hon = collections.defaultdict(collections.Counter)
def award(n, key):
    c = find(n)
    if len(c) == 1:
        hon[c[0]][key] += 1
    elif not c:
        missing.append(n)
    else:
        # ambiguous (e.g. two players share a name): give it to the more decorated/famous one
        hon[max(c, key=lambda i: out[i]['apps'] + out[i]['goals'] * 3)][key] += 1
for n in hnames(HALL_OF_FAME):
    award(n, 'H')
for y, ns in GOLDEN_BOOT.items():
    for n in hnames(ns):
        award(n, 'B')
# Golden Boots from 2016/17 on, straight from the FPL goal data
code_idx = {p['code']: i for i, p in enumerate(out) if p['code']}
for y in sorted({y for ss in fpl_seasons.values() for y in ss}):
    if y < 2016:
        continue
    tot = {c: ss[y]['goals'] for c, ss in fpl_seasons.items() if y in ss}
    top = max(tot.values())
    if y == max(team_names):  # current season still in progress
        continue
    for c, g in tot.items():
        if g == top and c in code_idx:
            hon[code_idx[c]]['B'] += 1
            print('Golden Boot', y, out[code_idx[c]]['name'], g, file=sys.stderr)
for y, ns in WORLD_CUP.items():
    for n in hnames(ns):
        award(n, 'W')
for y, ns in CHAMPIONS_LEAGUE.items():
    for n in hnames(ns):
        award(n, 'C')
print('honour names not found (fine if they had < 50 PL apps):', missing, file=sys.stderr)

# PL champions from 2025/26 on: work out the table from FPL results
champs = dict(CHAMPIONS)
for sdir in sorted(glob.glob(f'{FPL}/20*')):
    y = int(os.path.basename(sdir)[:4])
    if y in champs:
        continue
    g = pd.read_csv(f'{sdir}/gws/merged_gw.csv', encoding='latin1', low_memory=False)
    fx = g.drop_duplicates(['fixture', 'was_home'])
    if fx.fixture.nunique() < 380:
        continue  # season not finished
    pts = collections.Counter()
    for r in fx.itertuples():
        us_, them = (r.team_h_score, r.team_a_score) if r.was_home else (r.team_a_score, r.team_h_score)
        opp = r.opponent_team
        pts[('opp', opp)] += 3 if them > us_ else 1 if them == us_ else 0
    tn = team_names[y]
    best = max(pts, key=pts.get)
    champs[y] = tn[best[1]]
    print('Champions', y, champs[y], pts[best], file=sys.stderr)
# title winners: player had a known stint at the champion club that season
for i, p in enumerate(out):
    for c, ys in p['stints'].items():
        for y in ys:
            if champs.get(y) == c:
                hon[i]['P'] += 1

# teammates from Transfermarkt "played with" lists (only counted where both share a PL club)
tm_id = {}
TMP = pd.read_csv(f'{S}/football-datasets/datalake/transfermarkt/player_profiles/player_profiles.csv', low_memory=False,
                  usecols=['player_id', 'player_name', 'date_of_birth', 'citizenship', 'position', 'main_position'])
for i, p in enumerate(out):
    m = tm_match(p)
    if m is not None:
        tm_id[int(TMP.player_id[m.Index])] = i
TMT = pd.read_csv(f'{S}/football-datasets/datalake/transfermarkt/player_teammates_played_with/player_teammates_played_with.csv',
                  usecols=['player_id', 'teammate_player_id'])
links = set()
for a_, b_ in zip(TMT.player_id, TMT.teammate_player_id):
    if a_ in tm_id and b_ in tm_id:
        i, j = sorted((tm_id[a_], tm_id[b_]))
        if i != j and set(out[i]['clubs']) & set(out[j]['clubs']):
            links.add((i, j))
print('TM teammate links', len(links), 'TM ids', len(tm_id), file=sys.stderr)

def stint_str(st):
    parts = []
    for c, ys in st.items():
        ys = sorted(ys)
        runs, start, prev = [], ys[0], ys[0]
        for y in ys[1:] + [None]:
            if y is not None and y == prev + 1:
                prev = y
                continue
            runs.append(f'{start - 1992}' if start == prev else f'{start - 1992}-{prev - 1992}')
            if y is not None:
                start = prev = y
        parts.append(f'{c}:' + '.'.join(runs))
    return '|'.join(parts)

clubs = sorted({c for p in out for c in p['clubs']})
nats = sorted({p['nat'] for p in out if p['nat']})
compact = dict(
    generated=LATEST_MATCH,
    clubs=clubs, nats=nats,
    # [name, positions 'CM/ST', natIdx(-1 unknown), [clubIdx...], apps, goals, firstSeason, lastSeason, fplCode(0 none),
    #  assists, known club stints 'clubIdx:yy-yy.yy|...' (yy = season - 1992), honours e.g. 'H1B2W1C1P3']
    links=[x for l in sorted(links) for x in l],
    players=[[p['name'], p['poss'],
              nats.index(p['nat']) if p['nat'] else -1, [clubs.index(c) for c in p['clubs']],
              p['apps'], p['goals'], p['first'], p['last'], int(p['code'] or 0), p['ast'],
              stint_str({clubs.index(c): ys for c, ys in p['stints'].items() if c in clubs}),
              ''.join(f'{k}{v}' for k, v in sorted(hon[i].items()))] for i, p in enumerate(out)])
OUT = os.environ.get('OUT', f'{S}/players.js')
with open(OUT, 'w') as f:
    f.write('// Generated by tools/build_players.py - do not edit by hand\n')
    f.write('window.PL_DATA=' + json.dumps(compact, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('wrote', OUT, os.path.getsize(OUT), 'bytes', file=sys.stderr)
