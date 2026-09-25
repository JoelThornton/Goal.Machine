# Goal Machine ⚽

A fan-made take on FourFourTwo's 442GOALS: build a 4-4-2 whose players have scored exactly **442 Premier League goals**.
It includes **2,039 players**: everyone with 50+ PL appearances from 1992/93 to today.

Live: `https://opportunisticgames.github.io/goal-machine/` (a free site by Opportunistic Games)

## Modes

| Mode | What it is |
| --- | --- |
| 👑 Ultimate Wildcard | The main game. Build the XI with the biggest total of PL **goals**, **assists** or **appearances** (you choose). Every 50+ app player is equally likely, so you have to find the stars among the journeymen. Your score is the total |
| 📅 Daily Ultimate | Ultimate Wildcard (goals) with the same spins for everyone that day and one attempt |
| 🎯 Target | Hit the number: **500 goals**, **350 assists** or **3,750 apps**. The reels lean towards well-known players. Closeness scores up to 1,000 points, and hitting it exactly adds a +500 bullseye bonus |
| 🏆 The Treble | One XI, three targets: **400 goals, 300 assists and 3,300 apps**. Up to 333 points per stat. All three within 3% wins the Treble (+500), and two within 3% is the Double (+150) |
| 🎲 Mystery Target | A random stat and a secret number (e.g. somewhere between 300 and 650 goals). A thermometer shows how close you are (🥶 → 🔥 → 🎯 → 💥), and the target is revealed at full time |
| 🦘 Club Hopper | Name a player from the club on screen, then hop to one of his other PL clubs. See how many hops you can make in 90 seconds |
| ↕️ Higher or Lower | Who has more PL goals or apps? Keep the streak going |
| 🕵️ Who Am I? | Guess the player from clues |
| #️⃣ Club Grid | Immaculate-Grid style (daily or random). Obscure answers score more |
| 🔢 Guess the Tally | How many PL goals did he score? |

**🥵 Hard mode** (the toggle on the home screen):
- **All games:** cards show only names and positions (no clubs, years, apps, nationality, photos or club colours), and the Who Am I?, Club Grid and Club Hopper suggestions list names only.
- **Target, The Treble and Mystery Target:** the reels also show far fewer stars. The weighting is square-rooted, so Shearer is about 4× as likely as an average player instead of about 16×, while the targets stay the same. Always taking the biggest number reaches 500 goals in about 18% of games, against 74% in normal mode.
- **Leaderboards:** hard scores have their own boards.

You keep spinning until the XI is full. Tap a player, then tap one of the highlighted slots he can play.

### Full-time report

After every draft you get:
- **A squad rating and tier,** from ☠️ Relegation certainties up to 👑 Invincibles. It's based on experience, output in each position, honours and chemistry
- **👍 One good thing and 👎 one bad thing** about the team
- **Badges on each player:** 🏛️ Hall of Famer, 👟 Golden Boot, 🌍 World Cup winner, ⭐ Champions League winner, 🏆 in a PL title-winning squad, 💯 100 Club, 🅰️ Playmaker, 🎖️ 400+ apps, ❤️ one-club man, 🧳 journeyman
- **🤝 A list of who played together**

### Wildcards

| | Wildcard | Effect |
| --- | --- | --- |
| 🔍 | Scout's IQ | Shows the goal tallies on the reels this turn |
| 🎰 | Roll Again | A free re-spin |
| 🔄 | Make a Sub | Releases a player from your XI, taking his goals off |
| 💯 | Centurion Throw | A free spin of players with 100+ PL goals |
| ⚡ | Gegenpress | Your wide midfield slots become strikers (4-2-4) |
| 🚌 | Park the Bus | Two empty attacking slots drop into defence |
| ©️ | Captain's Armband | Your next signing's goals count double |
| 🩹 | Rotation Risk | Your next signing's goals count half |
| 🎲 | Double or Nothing | Coin toss: your next signing counts ×2 or ×0 |
| ⏰ | Deadline Day | A free spin with five players to choose from |
| ❤️ | One-Club Man | A free spin of players who played for only one PL club |
| 🧳 | Journeyman | A free spin of players with 4+ PL clubs |
| 📼 | 90s Throwback | A free spin of players whose PL career began in the 90s |

### Positions

Every player has real positions: **GK, LB, CB, RB, LM, CM, RM, ST**. The XI's slots are GK, LB, CB, CB, RB, LM, CM, CM, RM, ST and ST, and a player can only go in a slot he actually played. Positions come from:

- **Transfermarkt profiles**, mapped onto these slots (winger → LM/RM, defensive or attacking midfield → CM, and so on)
- **`tools/positions_manual.py`**, a hand-compiled list covering about 650 players. It fills in the (mostly pre-2010) players Transfermarkt doesn't have and gives famous utility men their full range: Dublin ST/CB, Bale RM/LM/LB/ST, Milner CM/RM/LB/RB, Ashley Young, Phil Neville, O'Shea and others
- **FPL position changes and a goalscoring-midfielder rule**, which add a second role (a midfielder listed as a forward in FPL can also play ST)

You always choose the slot yourself from the highlighted options. Gegenpress turns empty LM/RM slots into strikers, and Park the Bus drops two empty attacking slots to centre-back. Corrections are welcome in `positions_manual.py`.

## 📒 Album & badges

- **Collection:** every player you sign in a draft is added to your album (x / 2,039).
- **Dream XI:** built automatically from your best collected player in each position, by goals, assists or apps.
- **Sets:** Hall of Fame, Golden Boot winners, World Cup winners, Champions League winners, the 100 Club, one-club men, and one for each club.
- **Badges:** 32 to unlock across every game, e.g. 300/400/500 Club, Bullseye, Invincibles, Band of Brothers, Globetrotter, Pantheon (collect every Hall of Famer).

The album is saved on your device.

## Install it like an app (Android / iPhone)

It is a PWA, so it works offline and can be installed:

- **Android (Chrome):** open the site and tap *📲 Install app* on the home screen (or ⋮ → *Install app*).
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android APK:** download it from https://github.com/OpportunisticGames/opportunisticgames.github.io/releases/latest/download/goal-machine.apk. The `android/` folder is a small WebView app around the live site, and the *Android APK* GitHub Actions workflow rebuilds and publishes it whenever `android/` changes on `master`. Because the app loads the live site, game updates need no new APK.
  - Goal Machine links (such as a friend's challenge) open straight in the app. `/.well-known/assetlinks.json` at the site root verifies this, and it must match the signing key's SHA-256 fingerprint.
  - The app tells the site its build number (`AndroidApp.version()`). Raise `GM.APP_MIN_BUILD` in `js/core.js` after an app change and older apps will show an update link.
- **Logo:** `tools/make_icons.js` draws it and writes every site and Android icon (`node goal-machine/tools/make_icons.js` from the repo root; needs Playwright).

## Global leaderboard

The leaderboard runs on the `goal-machine` Supabase project, and `config.js` holds its public (publishable) key. Row-level security only allows reading scores and adding new ones. The leaderboard shows each name's best score per mode through the `best_scores` view.
To recreate it in a new project, run this in the SQL editor:

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 20),
  mode text not null check (char_length(mode) <= 40),
  score integer not null check (score between 0 and 5000),
  meta jsonb
);
create index scores_mode_score on public.scores (mode, score desc);
alter table public.scores enable row level security;
create policy "anyone can read scores" on public.scores for select using (true);
create policy "anyone can add a score" on public.scores for insert with check (true);
create view public.best_scores with (security_invoker = on) as
  select distinct on (mode, lower(btrim(name))) mode, btrim(name) as name, score, created_at
  from public.scores order by mode, lower(btrim(name)), score desc, created_at asc;
grant select on public.best_scores to anon, authenticated;
```

Then put the project URL and the publishable key into `config.js`. There is no anti-cheat, so this setup suits a board shared with friends.

## Releasing an update

When you change any JS/CSS/data file, bump the `?v=` number on the file links in `index.html` and the `CACHE` name in `sw.js`. Players' browsers then fetch the new files straight away instead of showing a cached version.

## Data

`data/players.js` is generated by `tools/build_players.py` from public datasets:

- [mshodge/epl-stats](https://github.com/mshodge/epl-stats): premierleague.com player pages, complete up to March 2020
- [vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League): FPL gameweek data 2016/17 → today, plus FPL season history
- [douglasbc/scraping-understat-dataset](https://github.com/douglasbc/scraping-understat-dataset): Understat 2014/15–2021/22, used to fill 2014–16 for players missing from the first source
- [salimt/football-datasets](https://github.com/salimt/football-datasets): Transfermarkt profiles (nationalities, detailed positions) and teammate lists
- [ewenme/transfers](https://github.com/ewenme/transfers): every transfer in or out of PL and Championship clubs since 1992, used to work out which club each player was at each season (for chemistry and title badges)
- `tools/honours.py`: Hall of Fame, Golden Boot (pre-2016; later ones come from FPL), World Cup and Champions League winners, and PL champions

Assists are the official PL figures up to 2020 and FPL assists after that. FPL counts a few more assists than the official figures (e.g. it can credit an assist for winning a penalty).

The **Update player data** GitHub Action does this automatically every Tuesday: it runs `tools/fetch_sources.sh` and `tools/build_players.py`, checks the result with `tools/check_data.py`, and publishes it (bumping the version with `tools/bump_version.py`) only if the data changed. You can also run it from the repo's Actions tab.

To run it yourself:

```bash
mkdir src && cd src
git clone --depth 1 https://github.com/mshodge/epl-stats
git clone --depth 1 https://github.com/douglasbc/scraping-understat-dataset us
git clone --depth 1 https://github.com/ewenme/transfers
git clone --depth 1 --filter=blob:none --sparse https://github.com/vaastav/Fantasy-Premier-League fpl
(cd fpl && git sparse-checkout set --no-cone '/data/*/players_raw.csv' '/data/*/gws/merged_gw.csv' '/data/*/teams.csv' '/data/*/players/*/history.csv')
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse https://github.com/salimt/football-datasets
(cd football-datasets && git sparse-checkout set datalake/transfermarkt/player_profiles datalake/transfermarkt/player_teammates_played_with)
pip install pandas
SRC=$PWD OUT=../data/players.js python3 ../tools/build_players.py   # optional arg: minimum apps (default 50)
```

Caveats: the early seasons of a handful of players (flagged in the build log) are estimated from minutes played. Only Premier League games count.
