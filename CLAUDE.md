# Working notes for Claude sessions

This repo is mostly **Goal Machine** (`goal-machine/`), a Premier League XI-draft game. It is a static PWA served by
GitHub Pages at https://opportunisticgames.github.io/goal-machine/, with an Android WebView wrapper (`android/`).
The root `index.html` is the Opportunistic Games studio page (contact opportunisticyp@gmail.com), which Google Play
uses as the developer website (verified in Google Search Console). `goal-machine/README.md` describes every
game mode for players; this file is about how to work on it.

## Rules the owner has set
- Work on branch `claude/premier-league-guessing-game-dz6inz`. Open a PR to `master` and **merge only when the owner
  says so** (they usually reply "merge"). If the branch's last PR is already merged, start the branch again from `master`.
- The remote is `OpportunisticGames/opportunisticgames.github.io`. Sessions sometimes point `origin` somewhere else, so
  before pushing run `git remote set-url origin https://github.com/OpportunisticGames/opportunisticgames.github.io`.
- **Player feedback:** Settings → Report a bug or suggest something saves to the `feedback` table (kind, body, name,
  meta with version/build/phone/page, done). At the start of a session, read the rows where `done` is false, file
  them into the banks and set `done = true`.
- **Bug and idea banks:** `notes/BUGS.md` and `notes/IDEAS.md`. When the owner reports a bug, log it and fix it
  straight away, then move it to *Fixed* with the version. When they share an idea, log it (with their words and
  our notes and questions) and **discuss it, don't build it** until they say go. Read both at the start of a session.
- No personal names in the app, the address or the copy. No AI model names in commits, PRs or files.
- Write plainly in the owner's British English (the game's tone: short, friendly, football-y).
- Every release: add an entry at the top of `GM.UPDATES` in `js/updates.js`, then run `python3 tools/bump_version.py`
  from `goal-machine/` (it bumps every `?v=` in `index.html` and the service worker cache). `v` = the next cache
  number; `label` = the version players see, in three levels: **5.0** a big change to how the game plays, **4.10**
  new features or modes (4.9 → 4.10 → 4.11), **4.10.1** bug fixes and polish only (the Updates page folds these into
  the release they patch).
- **Announce feature releases:** after merging a release with a new mode or a big feature (4.10, 5.0, not fix-ups),
  insert one row into `announcements` (title, body, link to the new thing, e.g. `…/goal-machine/#/updates`).
  Players with "New game modes" on get it as a notification within ~15 minutes (once, for 3 days).

## Code map (`goal-machine/js/`, plain scripts on a global `GM`, no build step)
- `core.js` – shared helpers: storage (`GM.store`, keys prefixed `gm:`), seeded RNG (`GM.rng`), avatars and photo
  caching (`GM.avatar`, `GM._ph`), modals and notices, the leaderboard client (`GM.lb`: `top`, `mine`, `submit`),
  the in-game 🏆 pop-up (`GM.lbButton`, `GM.lbModal`, `GM.lbYou`), `GM.APP_MIN_BUILD`, accounts, backups.
- `app.js` – the router (`#/path?query`), Home (with sub-tabs), Settings, Ranks (`leaderboard()`), About, the
  CHAOS look (`GM.chaosLook`).
- `draft.js` – the draft engine for every XI mode (Ultimate, Classic, Extreme, Purist, Target, Treble, Mystery, Club,
  Daily, CHAOS). `RULES`, `WILDCARDS`, CHAOS `EVENTS`, reel generation (`makeReels`, seeded, so the same seed = the same
  game), scoring (`scoreFor`), rendering. The pitch is sized once by `fitPitch()`; everything under it sits in a
  fixed-height `.dock` so the layout never jumps. `render()` only draws while its own game is on screen.
- `online.js` – online games with friends: the hub (sub-tabs Games / Finished / League / Friends), Draft Duel,
  Scout Duel (card hand + bonus cards), Live Race and its variants Target Race and CHAOS Race (race = both play the
  same seed; the variant picks the draft mode), the opponent live feed in races, the weekly league, notifications.
- `market.js` – Moneyball, Transfer Window, Auction (online + pass-and-play).
- `hattrick.js` – 🃏 Hat-Trick: football Spades (cards: number/suit/name on the edge strip, the player's face on the card; tap to preview with ▶ Play; offline card strength `ht:stat`), you + a computer partner v two computer rivals. `deal`
  (52 players, 4 suits, ⭐ Legends are trumps), `legal`, `winning`, `cpuBid`, `cpuPlay`, Spades scoring (bags = 🟨,
  10 = −100), first to 250. Menu: opponents Easy/Medium/Hard (`ht:level`), card numbers shown/hidden (`ht:hidden`, hidden scores go to `hattrickh`). Saved in `ht:save`. Dark card-table look via `body.ht-mode`; sounds `card`, `trickwin`, `tricklose`. Board: winning margin.
  Two jokers (`Jsub` wins the trick, `Jvar` gives it to the lowest of the suit led; playable any time, not as a lead); the lowest Defender and Midfielder make way. Cards: kit per suit, number/suit/name in the left strip (`.htc-edge`) so a fanned hand reads. Online (`GM.hattrickOnline`): a duel room with variant `hattrick`; only the humans' moves are stored ({t:'b',n} / {t:'p',c}, s = host/guest), and `replay` rebuilds the game from the room seed with the computers (seats 2, 3) on the never-random Hard play, so both phones agree. The final mover posts both team scores (p_all) and gm_finalise gives the higher 100–0.
- `modes.js` – quick games (Club Hopper, Higher or Lower, Who Am I?, Club Grid, Guess the Tally); `h2h.js` – pass-the-phone series.
- `daily.js` – Today page, Footle, daily streaks. `collection.js` – Album, badges, Dream XIs. `report.js` – full-time report.
- `picture.js` – share-a-picture of your XI. `audio.js` – synthesised sound + music. `updates.js` – changelog.
- Data: `data/players.js` (2,039 players with 50+ apps), the full list is loaded on demand; built by `tools/build_players.py`.

## Backend (Supabase project `tberlvceqqspgwlfzisy`)
Everything goes through security-definer RPCs that check the account with `gm_auth(p_user, p_key)`.
- Accounts and scores: `claim_name`, `submit_score`; the public `best_scores` view feeds the leaderboards.
- Online: `online_create` (kind `race` / `duel` / `auction`, optional `p_variant`: `scout`, `target`, `chaos`),
  `online_join`, `online_get`, `online_move`, `online_bid`, `online_resign`, `online_games`, `online_waiting`,
  friends (`online_friends`, `online_add_friend`, `online_remove_friend`), `friends_week` (league).
- Quick match: `quick_match(p_user, p_key, p_kind, p_stat, p_variant)` joins the oldest open `quick` room of that game
  from the last 30 minutes, reuses your own waiting one, or opens one (max 3); no auto-befriend. Turn-by-turn games
  offer the computer after a minute (`QM_WAIT` in online.js); a Live Race just starts.
- `gm_finalise` decides results once both players are done: races 50/30/20 (total / rating / speed), duels and
  auction 60/40, Target Race = closest (`d`) wins 100–0, CHAOS Race = most CHAOS points (`c`) wins 100–0.
- Names: `gm_name_ok` (offensive-word filter, used by `claim_name`, `rename_account` and `name_available`, which returns
  null for a banned name), `report_name` (3 reports hide a name from `best_scores` / `daily_board` via `players.name_hidden`),
  `name_status`, `rename_account` (moves scores, friends, rooms and backup to the new name).
- **Instant push (Firebase Cloud Messaging, project `opportunistic-games`):** phones register with `set_push_token`
  (token + their notification choices, `push_tokens`). Triggers on `rooms` and `friends` call `gm_push`, which posts
  (pg_net, shared secret in `private_config`) to the Edge Function `push`: for each phone it asks `app_inbox` and
  pushes new game/result/friend items once (`push_sent`). Needs the `FCM_SERVICE_ACCOUNT` Edge Function secret. The
  app's `PushService` shows them (same ids as the 15-minute check, so never twice). Reminders stay with the check.
- Notifications: `app_inbox(p_user, p_prefs, p_state, p_tz)` returns what the Android app should notify about. The app
  sends the player's choices from Settings (`GM.notify`: move, friends, results, modes, streak, comeback, daily time),
  their daily streak and time zone. **To announce a new game mode**, insert a row into `announcements` (title, body,
  link): every app with "New game modes" on shows it once, for 3 days.
- Also: `save_backup` / `load_backup`, `delete_account`, avatars
  (`set_avatar`, `get_avatars`, `report_avatar`).
Change SQL with the Supabase MCP tools (`apply_migration`); read a function first with `pg_get_functiondef`.

## Android app (`android/`)
`MainActivity.java` hosts the site in a WebView and exposes a JS bridge (called safely from the web with
`GM.app('fn', ...)`); `GameCheckService.java` polls `app_inbox` for notifications. Pushing changes under `android/`
runs `.github/workflows/android.yml`, which builds a signed APK and publishes a release (`versionCode` = run number).
Raise `GM.APP_MIN_BUILD` in `core.js` only when the web code needs a newer app; players below it see an update prompt.
Most changes are web-only and reach the app automatically.

## Testing
There's no unit test suite; test in a real browser with Playwright (Chromium is pre-installed in cloud sessions).
1. Serve the repo root: `python3 -m http.server 8765` from the repo root (it sometimes dies; just restart it).
2. Run a script from `goal-machine/tools/test/` with `node <script>.js`. Each uses `mockserver.js`, which fakes the
   Supabase RPCs in memory (test accounts Alice/Bob/Cara), so nothing touches the real database.
   - `sweep.js` – opens every page in light, dark and club themes: page errors and sideways overflow.
   - `races.js` – two phones play a Target Race and a CHAOS Race end to end.
   - `quickmatch.js` – pairing, no auto-friend, and the computer fallback after a minute.
   - `htonline.js` – two phones play Hat-Trick online to full time.
   - `hattrick.js` – 200 computer hands check the Hat-Trick rules, then a hand is played through the screen.
   - `features.js` – CHAOS formations, Target percentages, the Players filter, feedback and badges.
   - `cards.js` – every reel card fits, even with bigger text (`FS=130% node cards.js`).
   - `names.js` – rude names refused, reporting a name, a hidden name renamed, and no Soundtrack in the Play app.
   - `layout.js` – plays whole drafts and checks the pitch never changes size (`node layout.js "chaos:1,ultimate:0" 360x740`).
   Screenshots land in `./lay/` (ignored by git). Block photo hosts with `ctx.route(...)` to keep runs fast.
3. Tests set `gm:welcomed` and `gm:seenVersion` in localStorage so the welcome and What's New pop-ups stay out of the way.

## Things that tripped us up before
- The draft re-renders the whole screen on every tap: anything that must persist between taps (the race opponent
  bar, photo crops) is kept outside `render()`.
- Face-centred photos: crops are cached as percentages per photo URL, and dead photo links are remembered, so faces don't flicker.
- `best_scores` modes carry suffixes: stat (`ast`, `apps`) and Hard (`h`), e.g. `chaosh`, `ultimateasth`; dailies use `daily:YYYY-MM-DD`.
- The Play app (`GM.playSafe`) leaves out the premierleague.com / Transfermarkt photos and the 🎧 Soundtrack (the
  Epidemic Sound licence covers the website only).
- CHAOS scores are points (the XI total plus bonuses), not goals: label them `pts`.
