# 🐞 Bug bank

Bugs reported by the owner (or found along the way). **Bugs get fixed straight away**, then move to *Fixed* with the
version they shipped in. Newest at the top.

## Open

_Nothing open._

## Fixed

| Reported | Bug | Fixed in |
|---|---|---|
| 2026-09-26 | Wildcard cards (e.g. 🩹 Rotation Risk) cut their description off after a few words | 4.10: cards measure themselves and shrink the icon or tag until the text fits |
| 2026-09-26 | The bottom of player cards (the apps line) was cut off on iPhone, mostly with two-line names (seen in CHAOS, affected every draft) | 4.10: cards measure themselves; club badges, then the photo size, give way so the stat box always shows. Test: `tools/test/cards.js` |
| 2026-09-26 | The What's New pop-up vanished after about 5 seconds on the first open after an update | 4.10: the new version taking over no longer reloads the page while the pop-up is open, and it only counts as seen once you close it |
