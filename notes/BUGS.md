# 🐞 Bug bank

Bugs reported by the owner (or found along the way). **Bugs get fixed straight away**, then move to *Fixed* with the
version they shipped in. Newest at the top.

## Open

| Reported | Bug | Status |
|---|---|---|

## Fixed

| Reported | Bug | Fixed in |
|---|---|---|
| 2026-09-26 | Results spread charts topped out at 800+ (fixed bands), and CHAOS charted goals, not its points (often 800+) | 5.4: every score kept per mode, eight round-sized bands fitted to your range; CHAOS charts points |
| 2026-09-26 | Owner: dailies not refreshing (25th not lit, streak stuck at 1, Moneyball/CHAOS not replayable) | Not a bug: the server shows Daily Moneyball, CHAOS and Ultimate all played on the 26th and nothing on the 25th (last before that the 24th) |
| 2026-09-26 | A friend's phone said "Instant notifications: waiting for Google Play services" and got ~15 notifications at once from the 15-minute check. Only one phone had ever registered for instant pushes; the Firebase token request fails silently and was only retried when the app opened | 5.4 (needs the new app build): the failure reason is saved and shown in Settings, the background check keeps retrying, and more than 3 at once arrive as one summary |
| 2026-09-26 | CHAOS: everything happened at once (event, storm, meter, reels) and the effect was only a line of text | 5.4: CHAOS rebuilt around one moment at a time on the pitch (see the ideas bank) |
| 2026-09-26 | The music sometimes popped when opening or leaving the app: the sound was paused mid-wave (and the soundtrack cut dead) | 5.3: everything fades out before pausing and fades back in on return |
| 2026-09-26 | Quick match had too many choices (3 games × 3 stats), so people waiting could miss each other, and a Draft Duel's fallback said "Play the computer" but started a solo draft | 5.3: one game a day for everyone, always goals; the fallback says "Play on your own" and starts the matching solo mode |
| 2026-09-26 | Online: no way to leave a Live Race once the draft had started, and a Quick match race let you build your XI before anyone joined (a head start that defeats the point of a race) | 5.3: Quick match races wait for an opponent, with "Play on your own instead" after a minute; ✕ on the race bar leaves (cancels an unanswered invite, or ends a race in progress) |
| 2026-09-26 | No background notifications ever arrived (owner + a friend). The 4.9.1 diagnostics showed the cause: SecurityException, ACCESS_NETWORK_STATE required for jobs with a connectivity constraint (Android 14+) | 5.2 / app build 25: permission added, with a fallback job without the network condition. **Confirm on the phone:** Settings says "Checking every ~15 min" |
| 2026-09-26 | The ‹ back arrow often didn't work: only the character itself was tappable, and in a Hat-Trick game it pointed at the page you were on | 5.2: a 48 px target, and ‹ to the current page redraws it (Hat-Trick → the menu) |
| 2026-09-26 | Online: an unanswered Draft Duel invite said "your opponent is picking" and "Their's XI"; the invite text was muddled | 4.12: "Waiting for your mate to join", "Their XI", and a clear invite box with the code and Send invite |
| 2026-09-26 | About → The data said there are only 2,039 players, but every PL player (5,157) is in now | 4.10: says everyone who's played in the PL since 1992/93, and that most modes use the 2,039 with 50+ apps |
| 2026-09-26 | Album's sub-tabs (Album / Purist / Players) wrapped onto two lines, and ‹ on Players went to the home screen | 4.10: one line of tabs, also shown on the Players page, and ‹ goes back to where you came from |
| 2026-09-26 | Wildcard cards (e.g. 🩹 Rotation Risk) cut their description off after a few words | 4.10: cards measure themselves and shrink the icon or tag until the text fits |
| 2026-09-26 | The bottom of player cards (the apps line) was cut off on the owner's Pixel (bigger text than the test browser), mostly with two-line names (seen in CHAOS, affected every draft) | 4.10: cards measure themselves; club badges, then the photo size, give way so the stat box always shows. Test: `tools/test/cards.js` |
| 2026-09-26 | The What's New pop-up vanished after about 5 seconds on the first open after an update | 4.10: the new version taking over no longer reloads the page while the pop-up is open, and it only counts as seen once you close it |
