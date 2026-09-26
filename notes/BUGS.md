# 🐞 Bug bank

Bugs reported by the owner (or found along the way). **Bugs get fixed straight away**, then move to *Fixed* with the
version they shipped in. Newest at the top.

## Open

| Reported | Bug | Status |
|---|---|---|

## Fixed

| Reported | Bug | Fixed in |
|---|---|---|
| 2026-09-26 | No background notifications ever arrived (owner + a friend). The 4.9.1 diagnostics showed the cause: SecurityException, ACCESS_NETWORK_STATE required for jobs with a connectivity constraint (Android 14+) | 5.2 / app build 25: permission added, with a fallback job without the network condition. **Confirm on the phone:** Settings says "Checking every ~15 min" |
| 2026-09-26 | The ‹ back arrow often didn't work: only the character itself was tappable, and in a Hat-Trick game it pointed at the page you were on | 5.2: a 48 px target, and ‹ to the current page redraws it (Hat-Trick → the menu) |
| 2026-09-26 | Online: an unanswered Draft Duel invite said "your opponent is picking" and "Their's XI"; the invite text was muddled | 4.12: "Waiting for your mate to join", "Their XI", and a clear invite box with the code and Send invite |
| 2026-09-26 | About → The data said there are only 2,039 players, but every PL player (5,157) is in now | 4.10: says everyone who's played in the PL since 1992/93, and that most modes use the 2,039 with 50+ apps |
| 2026-09-26 | Album's sub-tabs (Album / Purist / Players) wrapped onto two lines, and ‹ on Players went to the home screen | 4.10: one line of tabs, also shown on the Players page, and ‹ goes back to where you came from |
| 2026-09-26 | Wildcard cards (e.g. 🩹 Rotation Risk) cut their description off after a few words | 4.10: cards measure themselves and shrink the icon or tag until the text fits |
| 2026-09-26 | The bottom of player cards (the apps line) was cut off on the owner's Pixel (bigger text than the test browser), mostly with two-line names (seen in CHAOS, affected every draft) | 4.10: cards measure themselves; club badges, then the photo size, give way so the stat box always shows. Test: `tools/test/cards.js` |
| 2026-09-26 | The What's New pop-up vanished after about 5 seconds on the first open after an update | 4.10: the new version taking over no longer reloads the page while the pop-up is open, and it only counts as seen once you close it |
