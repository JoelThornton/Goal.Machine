# Goal Machine ⚽

A fan-made take on FourFourTwo's 442GOALS: build a 4-4-2 whose players have scored exactly **442 Premier League goals**.
It includes **2,039 players**: everyone with 50+ PL appearances from 1992/93 to today.

Live (once merged to the Pages branch): `https://joelthornton.github.io/goal-machine/`

## Modes

| Mode | What it is |
| --- | --- |
| 📅 Daily 442 | The same spins for everyone today, one attempt, with a shareable emoji result |
| 🃏 Wildcard | 13 wildcards appear on the reels (see below). You get 16 spins for 11 signings, so grabbing a wildcard costs a spare spin |
| ⚽ Classic | No help |
| 💀 Hardcore | Go over 442 and you bust with a score of zero; survive and your score is ×1.5 |
| 🔦 Deep Cuts | Every 50-app player is equally likely, so expect lots of journeymen. The target is 200 |
| ↕️ Higher or Lower | More PL goals or apps? Keep the streak going |
| 🕵️ Who Am I? | Guess the player from his club path, with clues revealed one at a time |
| #️⃣ Club Grid | A 3×3 grid in the Immaculate Grid style (daily or random). Obscure answers score more |
| 🎯 Guess the Tally | How many PL goals did he score? |

**Scoring (442 modes):** 1000 − 5 × (goals off target), plus 500 for a bullseye and +50 for each unused wildcard.

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

When a player fits more than one open slot, you choose where he plays. Gegenpress turns empty LM/RM slots into strikers, and Park the Bus drops two empty attacking slots to centre-back. Corrections are welcome in `positions_manual.py`.

## Install it like an app (Android / iPhone)

It is a PWA, so it works offline and can be installed:

- **Android (Chrome):** open the site and tap *📲 Install app* on the home screen (or ⋮ → *Install app*).
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **A real .apk:** go to https://www.pwabuilder.com, paste the site URL and choose *Android → Generate*. It wraps the site as a Trusted Web Activity APK you can sideload or send to friends.

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

## Data

`data/players.js` is generated by `tools/build_players.py` from public datasets:

- [mshodge/epl-stats](https://github.com/mshodge/epl-stats): premierleague.com player pages, complete up to March 2020
- [vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League): FPL gameweek data 2016/17 → today, plus FPL season history
- [douglasbc/scraping-understat-dataset](https://github.com/douglasbc/scraping-understat-dataset): Understat 2014/15–2021/22, used to fill 2014–16 for players missing from the first source
- [salimt/football-datasets](https://github.com/salimt/football-datasets): Transfermarkt profiles, used for missing nationalities

To refresh after new gameweeks:

```bash
mkdir src && cd src
git clone --depth 1 https://github.com/mshodge/epl-stats
git clone --depth 1 https://github.com/douglasbc/scraping-understat-dataset us
git clone --depth 1 --filter=blob:none --sparse https://github.com/vaastav/Fantasy-Premier-League fpl
(cd fpl && git sparse-checkout set --no-cone '/data/*/players_raw.csv' '/data/*/gws/merged_gw.csv' '/data/*/teams.csv' '/data/*/players/*/history.csv')
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse https://github.com/salimt/football-datasets
(cd football-datasets && git sparse-checkout set datalake/transfermarkt/player_profiles)
pip install pandas
SRC=$PWD OUT=../data/players.js python3 ../tools/build_players.py   # optional arg: minimum apps (default 50)
```

Caveats: the early seasons of a handful of players (flagged in the build log) are estimated from minutes played. Only Premier League games count.
