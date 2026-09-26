# 💡 Ideas bank

Ideas for Goal Machine and future games. **Nothing here gets built until we've talked it through and the owner says
go.** Each idea keeps its notes and questions so a later session can pick it up. Status: 💬 to discuss · 🟢 agreed
(ready to build) · 🚧 being built · ✅ shipped · 🧊 parked.

## 💬 To discuss

### Settings: a sub-menu system
- **Owner's idea:** Settings is getting long and needs sub-menus.
- **Proposal:** the Settings page becomes a short menu, each row showing its current value, with one sub-page each:
  👤 Account ("🔒 Joel") · 🎨 Look & club ("Dark · Arsenal") · 🔊 Sound & vibration ("Music: Game") ·
  🔔 Notifications, app only ("6 of 7 on") · 🎮 Gameplay ("Normal"). The links underneath (share, how it works,
  updates, about, privacy) stay as they are. ‹ on a sub-page goes back to Settings.

### Money games need more depth (Moneyball, Transfer Window, Auction)
- **Owner's take:** there's something there, but it isn't satisfying. By two-thirds of the way through you're often
  left with one affordable option (a free transfer), and it boils down to "longest career for the cost". It lacks the
  tension of the spin games. It probably needs an opponent (the computer, or a person online) and more depth.
- **Notes:** the fun in the spin games is risk and the unknown. Here everything is known and the budget squeezes out
  choice. Directions to talk through:
  - an AI rival bidding on the same market, who takes players you hesitate on
  - hidden or partly hidden values (a scout report gives a range, not the number)
  - prices that move as the window goes on (deadline-day panic, bargains late)
  - selling: buy low, sell a player back mid-window to fund a star
  - a squad need each round ("you need a CB by round 6")
  - a guaranteed floor so the last picks are still choices, not one free transfer

### Weekly Premier League trivia quiz
- **Owner's idea:** a weekly quiz.
- **Questions:** questions from our own data (tallies, clubs, seasons), or hand-written about that week's real
  matches? The data-only version can be automatic; topical questions need someone to write them each week (or a
  weekly data refresh that turns into questions). Leaderboard for the week, streaks across weeks?

### Hidden things: secrets, unlocks, easter eggs
- **Owner's idea:** hidden items, unlocks and secrets to keep the game exciting.
- **Notes:** some directions, from light to heavy:
  - secret badges (hidden in the list as "???" until earned): an all-one-club XI, exactly 442 goals, a 0-goal XI
  - easter eggs triggered by real football moments: sign Aguero with the last spin → "AGUEROOOO" commentary
  - unlockable looks: pitch styles, retro kits for the card design, earned rather than bought
  - a hidden mode that appears after something special (e.g. completing a club's full set in the Album)
  - rare "legend" reel cards with a special shine (cosmetic)
- **Questions:** cosmetic only, or can unlocks change gameplay (a new wildcard)? Should secrets be shareable
  ("I found the hidden mode") to spread word of mouth?

### CHAOS: random formations
- **Owner's idea:** CHAOS should randomise the formation: 4-4-2, 4-5-1, 3-5-2, 5-4-1 and so on.
- **Notes:** fits CHAOS well. The pitch already supports formation changes (Gegenpress and Park the Bus move
  slots), so a random starting shape is mostly data. Questions: one random formation per game (shown at kick-off),
  or can CHAOS events switch it mid-game ("the manager's changed it to 3-5-2!")? Should the Daily CHAOS use the same
  formation for everyone that day (yes, since it's seeded)? Do formations with fewer strikers need their own
  leaderboard balance? Probably not in CHAOS, as it's meant to be random.

### Players tab: which players you have and haven't signed
- **Owner's idea:** show which players you have and don't have on the Players page.
- **Notes:** no storage cost. The Album already remembers every player you've signed, and the list shows ✍️×n for
  players you've signed. We could add a filter (All / ✅ Signed / ❌ Not yet) and grey out the ones you've never
  had. Small job; ready whenever you say go.

### More badges, including online badges
- **Owner's idea:** more badges at some point, including ones for online play. Once there are 100 or so, sort
  them into categories.
- **Notes:** there are 35 now. Online ones could be: first online win, win a Draft Duel / Live Race / Target Race /
  CHAOS Race, beat 5 different friends, top your weekly league, a winning streak. Categories could be: Drafting,
  Dailies, Collecting, Online, Quick games, Secret (hidden until earned).

### Target games: difficulty and how scores are shown
- **Owner's take:** 500 goals is about right, though it's easier to go over than under. Appearances are very hard
  to reach. Assists are OK, slightly hard, but doable with one big assister. The PB and leaderboard show points,
  which don't tell you afterwards how close you were.
- **Notes:**
  - Show how close you were in your history, the PB line and the board. **Owner prefers a percentage:** 97% is
    clearly under and 103% clearly over, so the percentage on its own is enough (e.g. "97.6%", perhaps with the
    number, "488 goals · 97.6%"). The score can stay points for ranking; the percentage is extra detail saved
    with each score.
  - Appearances: check the numbers (how often a typical game reaches 3,750) and lower the target, or lean the
    reels further towards long careers.
  - Over vs under: maybe a small penalty for going over (like darts' bust), or make it symmetrical on purpose.

### Card game against the computer or online (Top Trumps style)
- **Owner's idea:** something like Top Trumps.
- **Notes:** fits our data well (goals, assists, apps, seasons, clubs, honours). Questions: a deck from your Album
  (collecting gets a purpose), or random? One stat per round chosen by the winner (classic), or the whole hand at
  once? The computer opponent needs to be beatable but not dumb. Online could reuse the Draft Duel turn system.

### Manager mode
- **Owner's idea:** some form of manager mode.
- **Questions:** what's the fantasy? Build a squad over a "season" of fixtures, simulate results from squad
  strength, manage a budget and transfers between gameweeks? It's a big feature, so a small first version would help
  work out whether it's fun.

## 🟢 Agreed

_None yet._

## ✅ Shipped

- **Version numbers** (4.10): three levels (5.0 big, 4.10 features, 4.10.1 fixes); fix-ups fold into their
  release on the Updates page.
- **Notification choices and reminders** (4.10): owner's spec. Each kind can be switched off in Settings. On by
  default: friend invites and challenges, your move, new game modes, come back (from noon on the 4th day without a
  game, and again after 2 weeks) and an 8pm streak reminder if the streak is about to end. Results are also on. There's
  a daily reminder at a chosen time (off by default). Announce a new mode by adding a row to `announcements`.
