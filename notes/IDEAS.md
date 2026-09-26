# 💡 Ideas bank

Ideas for Goal Machine and future games. **Nothing here gets built until we've talked it through and the owner says
go.** Each idea keeps its notes and questions so a later session can pick it up. Status: 💬 to discuss · 🟢 agreed
(ready to build) · 🚧 being built · ✅ shipped · 🧊 parked.

## 🗺️ Priority order (agreed with the owner as we go)

Aim: have a sticky, polished game for the Play closed test (12 testers × 14 days), then launch.

**Done in 4.10:** Target percentages and fairer targets, the Players signed filter, in-app feedback, CHAOS random
formations, and badges round 2.

**Next: medium (a day or two each), a reason to come back**
6. Weekly Premier League quiz, generated from our own data, with a weekly leaderboard
7. Share your whole day *(Claude's idea)*: one post for the group chat with every daily result ("Goal Machine ·
   26 Sep 🟩 Footle 3/8 · ⚽ Daily Ultimate 512 · #️⃣ Grid 7/9 · 🔥 12"), our best free advertising

**Later: big, design first**
8. Money games rework (an AI rival, hidden values, a deadline-day squeeze)
9. ~~Card game~~ shipped as 🃏 Hat-Trick (beta); next: online and a Daily Hat-Trick
10. Manager mode

## 💬 To discuss

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
- **Proposal: "Deadline Day", one transfer game against 3 computer managers** (replaces the three as they are):
  - Everyone starts with a budget and an empty XI; the window runs 8 rounds.
  - Each round a market of 5 players with asking prices. The true value (goals) is hidden: you get a scout report
    as a range ("110–160 goals"), and spend scouting tokens to narrow it.
  - Sealed bids against the rivals, who have personalities (the big spender, the bargain hunter, the panic buyer),
    so the player you hesitate on gets taken.
  - Prices fall as the window goes on, but the good players go first. The last round is Deadline Day: a frenzy.
  - Sell one player back mid-window to fund a star.
  - At the end, a 4-team league table decides the winner (XI totals + a little luck).
  - Online: the same thing with friends in the Auction room.

- **Owner, later:** unsure about the rework. Maybe the problem is goals themselves: make the goal *money*, more
  Monopoly-style? 🧊 Parked for now; come back to it.

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

### Manager mode
- **Owner's idea:** some form of manager mode.
- **Questions:** what's the fantasy? Build a squad over a "season" of fixtures, simulate results from squad
  strength, manage a budget and transfers between gameweeks? It's a big feature, so a small first version would help
  work out whether it's fun.

### Share your whole day *(Claude's idea)*
- Footle and the drafts already have share buttons. This adds one "Share my day" on the Today page: every daily
  result plus your streak in one spoiler-free post, with the link. One post a day in a group chat is how Wordle
  spread.

### Online lobby / quick match *(owner: "a BIG ask, fine if not right now")*
- **Idea:** a lobby to play people you don't know yet.
- **What it could be, in steps:**
  1. **Quick match:** tap "Find me a game" for a Live Race (the easiest online game). You join the oldest open
     quick-match game of that kind, or open one that the next person joins. No chat, no browsing strangers. That's
     simple and safe, and it's mostly server work (an `open` flag on rooms and a `quick_match` RPC).
  2. **Open lobby:** a list of open games ("Bob · Draft Duel · goals · 2 min ago") to pick from.
  3. **Live lobby:** see who's online now; needs Supabase Realtime.
- **Things to settle:** only players with a claimed name (and the name filter/reporting we have) can use it; what if
  nobody's around (fall back to a computer opponent after a minute?); a daily cap to stop spam; no messaging at all
  (keeps the Play content rating simple).
- **Hat-Trick online:** you + a computer partner v a friend + a computer partner (or 2 v 2 with friends).

## 🟢 Agreed

_None yet._

## ✅ Shipped

- **🃏 Hat-Trick (beta), 4.11:** football Spades, 4 players (you + a computer partner v 2 computer rivals).
  Normal shows the numbers (pure Spades), Hard hides them. Each game picks goals, assists or apps. **Next steps to
  discuss:** online (you + computer partner v a friend + computer partner), a Daily Hat-Trick, 2- and 3-player
  cut-throat, harder computer managers, and Nil bids for the computers.
- **4.10 top five:** Target games show a percentage (full time, PB, boards) and targets are fairer (apps 3,400,
  assists 325, from a 20,000-game simulation: a typical random XI has ~478 goals, ~288 assists, ~2,671 apps).
  Players page ✅/❌ filter. In-app feedback (`feedback` table). CHAOS random formations (7 shapes, seeded).
  13 new badges in 6 categories, incl. 6 online and 5 secret ("???") ones. The secret ones are the first step of
  *hidden things*.
- **Settings sub-menus** (4.10): a menu of Account, Look & club, Sound & vibration, Notifications and Gameplay,
  each showing its current value.
- **Version numbers** (4.10): three levels (5.0 big, 4.10 features, 4.10.1 fixes); fix-ups fold into their
  release on the Updates page.
- **Notification choices and reminders** (4.10): owner's spec. Each kind can be switched off in Settings. On by
  default: friend invites and challenges, your move, new game modes, come back (from noon on the 4th day without a
  game, and again after 2 weeks) and an 8pm streak reminder if the streak is about to end. Results are also on. There's
  a daily reminder at a chosen time (off by default). Announce a new mode by adding a row to `announcements`.
