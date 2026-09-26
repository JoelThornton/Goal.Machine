/* Goal Machine – what's new. Add an entry at the top for every release.
   v     = the ?v= number in index.html (bumped by tools/bump_version.py on every release; phones use it to fetch fresh files)
   label = the version players see, in three levels:
           5.0    a big change to how the game plays (1 launch, 2 Android app, 3 new look, 4 online)
           4.10   new features or modes (the next .1 after the last feature release: 4.9 → 4.10 → 4.11)
           4.10.1 bug fixes and polish only; the Updates page folds these into the release they patch */
'use strict';

(function () {
  GM.UPDATES = [
    {
      v: 33, label: '5.4', date: '2026-09-26', title: '🌪️ CHAOS, rebuilt',
      items: [
        '👔 Appoint a manager at kick-off: Fergie, Wenger, Mourinho, Pep, Klopp, Ranieri, Keegan and more. Each brings a perk and a catch, and 👍 / 👎 on the reels show who he’d want. He might get the sack…',
        '⚡ The CHAOS meter now fills when you take or play wildcards. When it’s full, the next spin opens with a big moment: a 🌪️ tornado through your XI, a ⚡ lightning strike, a 🚌 bus parade, ⏰ deadline day or 💥 CHAOS unleashed',
        '🎬 Every moment plays out one at a time, on the pitch: the ambulance arrives, VAR checks, numbers count up and down in front of you. Tap to skip',
        '🪙 All In and Double or Nothing toss a real coin',
        '📜 At full time, see everything that happened in your game',
        '📊 Your results spread stretches to fit your scores (no more piling up at 800+), and CHAOS charts its points',
        '🔔 Android: if instant notifications can’t start, Settings now says why, and the app keeps trying. A backlog arrives as one notification, not fifteen',
      ],
    },
    {
      v: 32, label: '5.3', date: '2026-09-26', title: '🎲 Quick match: a new game every day',
      items: [
        '🎲 Quick match is now one game a day, the same for everyone, so you’re all in the same queue and find a match faster. It rotates Live Race, Hat-Trick, CHAOS Race, Draft Duel, Target Race and Scout Duel, each with its own banner. Tomorrow’s game is shown too',
        '🏁 A Quick match race now waits for your opponent before anyone starts, so nobody gets a head start. After a minute you can play on your own instead',
        '✕ Leave a Live Race any time with the ✕ on the bar at the top of the draft',
        '🎵 The music fades out and back in when you leave and return to the app, instead of popping',
      ],
    },
    {
      v: 31, label: '5.2', date: '2026-09-26', app: 26, title: 'Instant notifications, and faces on the cards',
      items: [
        '⚡ Instant notifications: “your move”, challenges, results and new friends now arrive the moment they happen, not up to 15 minutes later. Get the new app (build 26) with the update button',
        '🔔 Found and fixed why notifications never came: Android had been refusing to schedule the app’s background check. After updating, ⚙️ Settings → Notifications should say “⚡ Instant notifications on” and “Checking every ~15 min”',
        '🃏 Hat-Trick cards show the player’s face, with the number once on the edge strip',
        '🔍 Pick a card up to see it in full: photo, whole name, clubs and number, with a big ▶ Play button. Every card on the pitch shows its full name too',
        '⚽ Offline Hat-Trick: choose the card strength (goals, assists or apps) or let it surprise you',
        '‹ The back arrow is easier to hit, and always works (in a Hat-Trick game it takes you to the menu)',
      ],
    },
    {
      v: 29, label: '5.1', date: '2026-09-26', title: '🎲 Quick match',
      items: [
        '🎲 Quick match on the Online tab: pick a Live Race, Hat-Trick or Draft Duel and we’ll pair you with someone waiting for the same game. No chat, just football',
        '🤖 Nobody about? After a minute you can play the computer instead, or keep waiting and we’ll let you know when someone joins',
        '🧑‍🤝‍🧑 People you meet in a Quick match aren’t added to your friends automatically',
      ],
    },
    {
      v: 28, label: '5.0', date: '2026-09-26', title: '🃏 Goal Machine 5: Hat-Trick goes online',
      items: [
        '⚽ Hat-Trick is now played on a Goal Machine pitch: the trick goes down in the centre circle, with a proper scoreboard. Us in lime, them in orange',
        '🎨 New cards, a kit for each suit: gold foil ⭐ Legends, red striped ⚽ Forwards, blue hooped ⚙️ Midfielders and green checked 🛡️ Defenders. The number, suit and name run down the edge, so you can read your whole hand at a glance',
        '🧠 In Hat-Trick, only 😊 Easy gives you a hint when you bid',
        '🃏🌐 Hat-Trick is online! Challenge a mate: you and Skipper against them and their computer partner. Take your turns whenever suits, and you’ll get a notification when it’s your go',
        '⚡ Play again: your usual opponents sit at the top of the Online tab. One tap and they’re picked, with the game you last played together',
        '🌐 Playing a mate online is simpler: New game is two steps (who against, then the game), with your friends first and the two easiest games first and the rest under More games. First-timers get a quick how-it-works and can join with a code straight from the Games tab',
        '🔗 Clearer invites: while you wait for your mate it says so, instead of saying they’re already picking',
        '🃏 Two jokers in the deck: 🦸 Super-Sub wins the trick, whatever else is played; 📺 VAR hands the trick to the lowest card of the suit led. Play them any time, but you can’t lead with one',
      ],
    },
    {
      v: 27, label: '4.11', date: '2026-09-26', app: 23, title: '🃏 Hat-Trick (beta) and a tidier Album',
      items: [
        '🃏 NEW: Hat-Trick, football Spades (beta). You and Skipper against the Gaffer and the Pundit, with a deck of 52 real PL players in four suits and ⭐ Legends as trumps. Bid your tricks, follow suit, first to 250. Each game picks goals, assists or appearances as the card strength',
        '😊😐😠 Choose Easy, Medium or Hard opponents, and 👀 shown or 🙈 hidden card numbers (hidden = play on your football knowledge). Your game is saved, so you can carry on later',
        '🏅 Two Hat-Trick badges to win: Card Sharp and Clean Sheet',
        '📒 The Album is in four sections: ⭐ Dream XI, 🏅 Badges, 🗂️ Sets and 📊 Stats, so there’s no long scroll',
        '🏅 Badges have a tab for each category: Scores, Squads, Dailies, Quick games, Online, Collecting and Secret, each with how many you’ve got',
        '📲 The Android app asks you to update to build 23, which fixes notifications that weren’t arriving. Tap the update button, install, and check ⚙️ Settings → Notifications says “Checking every ~15 min”',
      ],
    },
    {
      v: 26, label: '4.10', date: '2026-09-26', app: 16, title: 'Formations, secrets and fairer targets',
      items: [
        '🌪️ CHAOS kicks off in a random formation: 4-4-2, 4-5-1, 3-5-2, 5-4-1, 4-3-3, 3-4-3 or 5-3-2 (the same for everyone in the Daily CHAOS and in a CHAOS Race)',
        '🎯 Target games show how close you got as a percentage (97.6% is just under, 103% just over) on the full-time screen, your PB and the leaderboards',
        '⚖️ Fairer targets: appearances is now 3,400 (was 3,750) and assists 325 (was 350). Goals stays at 500',
        '🏅 13 new badges, sorted into categories: online wins, longer daily streaks, and 5 secret badges shown as ??? until you find them',
        '📖 Players page: filter by the players you’ve signed ✅ or haven’t yet ❌',
        '✉️ Settings → Report a bug or suggest something: it comes straight to us',
        '🔔 ⚙️ Settings → Notifications: pick what the Android app whistles about. Your move, challenges and friends, results, new game modes, a come-back nudge and an 8pm streak reminder are on to start with',
        '📅 A daily reminder at the time you choose, if you haven’t played the daily games yet (off to start with)',
        '🔥 The streak reminder only comes if your streak is about to end, and none of the reminders come once you’ve played that day',
        '⚙️ Settings is now a tidy menu: Account, Look & club, Sound & vibration, Notifications and Gameplay, each showing what it’s set to',
      ],
    },
    {
      v: 25, label: '4.9.1', date: '2026-09-26', app: 23, title: 'Cards that always fit',
      items: [
        '🃏 Player cards on the reels always show the stat box now, even with a two-line name or bigger text on your phone (the club badges and photo shrink to make room)',
        '🩹 Wildcards show their full description instead of cutting off after a few words',
        '📰 This What’s New pop-up stays open until you close it',
        '📒 The Album, Purist and Players tabs fit on one line, and ‹ on the Players page takes you back to where you came from',
        'ℹ️ About now says what’s really in the game: every one of the 5,000+ players to play in the Premier League',
        '🔔 Notifications: the Android app now restarts its background check every time you open it (Android had been dropping it), and ⚙️ Settings → Notifications says why they aren’t arriving, e.g. battery limits. Get the newest app from the About page',
      ],
    },
    {
      v: 24, label: '4.9', date: '2026-09-26', app: 16, title: 'Keeping the boards friendly',
      items: [
        '🚩 Tap a name on any leaderboard to report it if it’s offensive. A name reported by several players is hidden from the boards',
        '🙅 Offensive names can’t be claimed any more',
        '✏️ Changing your name in ⚙️ Settings now keeps your scores, friends, online games and backup',
      ],
    },
    {
      v: 23, label: '4.8', date: '2026-09-26', app: 16, title: 'Watch your opponent live',
      items: [
        '👀 In a Live, Target or CHAOS Race, the bar at the top now shows your opponent’s latest signing the moment they make it (it flashes), along with their score',
        '⚽ Tap the bar to see their whole XI so far on a mini pitch, with their newest signing highlighted',
      ],
    },
    {
      v: 22, label: '4.7', date: '2026-09-26', app: 16, title: 'All three wildcards, tidier stat buttons',
      items: [
        '🃏 Holding three wildcards? All three now fit on the bar (the third used to slide off the screen out of reach)',
        '⚽ Goals, assists and appearances look the same everywhere: icon on top, name underneath, all three in one row',
        '🐛 Leaving a game mid-animation could flash the draft back up over the page you went to. Fixed',
      ],
    },
    {
      v: 21, label: '4.6', date: '2026-09-26', app: 16, title: 'Target and CHAOS online',
      items: [
        '🎯 Target Race: a new online game. A different target every game (some much harder than others), the same spins for both of you, and whoever finishes closest wins',
        '🌪️ CHAOS Race: Ultimate Wildcard CHAOS online, with the same spins, events and storms for both of you. Most CHAOS points wins, and it comes with the full neon look and Mayhem',
      ],
    },
    {
      v: 20, label: '4.5', date: '2026-09-26', app: 16, title: 'No more flickering faces',
      items: [
        '🖼️ Fixed player pictures flickering during a game: a photo that didn’t load was being tried again every time you tapped, and faces were re-centred each time. Now each photo is worked out once and stays put',
        '⭐ Leaderboards show your account’s best score and your rank (e.g. #4 of 37) instead of your best on this device',
      ],
    },
    {
      v: 19, label: '4.4', date: '2026-09-26', app: 16, title: 'A steadier draft',
      items: [
        '📐 The draft screen holds still: the pitch is sized once for your phone and stays that size from the first spin to full time. The reels, the spin button, your wildcards and the messages share one fixed space underneath',
        '🏆 The leaderboard button in a game now opens that game’s leaderboard in a pop-up, so you never leave the game',
        '🪄 Tidier game screens: one-line titles (with a HARD tag), CHAOS events and hints in one place under the reels, and The Treble’s three counts side by side',
      ],
    },
    {
      v: 18, label: '4.3', date: '2026-09-26', app: 16, title: 'Less scrolling, easier leaderboards',
      items: [
        '🗂️ Home has tabs now (Main, Targets, Market, Quick & more), so you’re not scrolling past everything to find a game. The dailies live in the Today tab',
        '🌐 Online has tabs too: Games (your move first, with a count on the tab), Finished, League and Friends. Games waiting on you glow',
        '🏆 A leaderboard button in the corner of every game, next to the ?, opens that game’s leaderboard',
        '📊 Ranks is sorted into groups (Main event, CHAOS, Daily, Targets, Market, Quick) instead of one long list',
        '🃏 Scout Duel: your Scout, Blindfold and Swap cards sit big above the reels, and bonus cards turn up on the reels. Take one instead of a player to add it to your hand',
        '🌪️ CHAOS scores are shown as points everywhere (your XI’s total plus bonuses), the wildcard reel no longer shows a blank box, and the pitch grows to fill taller screens',
        '📅 Today fits on one screen, and the Normal / Hard descriptions are up to date',
      ],
    },
    {
      v: 17, label: '4.2', date: '2026-09-26', app: 16, title: 'CHAOS, the Online tab + your picks',
      items: [
        '🌪️ Ultimate Wildcard CHAOS, with its own neon look and its own music (Mayhem): bonus points for chemistry, squad rating, PL titles, Hall of Famers, one-club men, journeymen and veterans, random events (red cards, injuries, VAR, golden goals, masked men, mystery boxes…), wildcard storms, a CHAOS meter that unleashes double points, and new cards like 🎰 All In',
        '📅 Daily CHAOS: the same chaos for everyone, once a day, with a streak and a daily leaderboard',
        '🌐 Online gets its own tab (the Player index moves to the Album and the home screen), with a weekly league against your friends',
        '☁️ Back up your album, stats and streaks to your account (it happens automatically after games) and restore them on a new phone, or delete your account from Settings',
        '▶️ Leave a draft half-way and carry on where you left off; Moneyball and Transfer Window check before you leave',
        '📷 Profile pictures: add a photo in Settings and your friends and opponents see it in online games, your friends list and the weekly league (tap a friend to report a picture or remove them)',
        '🔔 Notifications fixed: anything that arrived while the game was open was quietly marked as seen, so it never buzzed. Settings now shows whether they’re allowed and working, with a test button and Check now',
        '👋 A quick welcome for new players, and NEW tags on modes you haven’t tried yet',
        '📊 Your picks: your most-signed players, the ones you always snub and the clubs you sign from (in the Album), and ✍️ signing counts in the Player index',
        '⭐ Separate Dream XIs: a player joins your goals, assists or appearances XI only when you sign him in that kind of game, and shows how many times you’ve had him',
        '🏟️ Club XI now uses everyone who played for your club in the Premier League, not just those with 50+ appearances',
        '↩️ In the Android app, back (button or swipe) goes to your last menu page instead of closing the app, and asks before quitting from the home screen',
      ],
    },
    {
      v: 16, label: '4.1', date: '2026-09-25', app: 13, title: 'Friends, the transfer market + match points',
      items: [
        '👥 Online games now belong to your 🔒 name: add friends, challenge them, take your turn whenever suits you, and pick your games back up on any phone',
        '🕵️ Scout Duel: a Draft Duel on scouting reports. No names, just a few clues on each player (the same for both of you), plus Scout, Blindfold and Swap cards to play once each',
        '💰 The transfer market: players are priced by reputation, not output, and tallies stay hidden. Moneyball (plus a Daily Moneyball), Transfer Window (buy, see who flops, sell) and Auction (secret bids, pass the phone or online)',
        '🖼️ Share a picture of your XI from the full-time screen and online games',
        '🔔 “Your move” alerts on the home screen, and notifications with a referee’s whistle in the Android app when a friend challenges you, it’s your pick or a game finishes',
        '📜 Every online game is kept: look back at finished games, both teams side by side, and your win-draw-loss record against each friend',
        '🏁 Live Race match points: 50 for the bigger total, 30 for the better squad rating and 20 for the quicker XI. Once you’ve finished, watch your friend’s XI fill up',
        '🤝 Draft Duel: five players a spin with at least two for each of you (no more empty reels late on), the challenged player picks first, and a 15-second pick clock when you’re both in the game',
        '🏟️ A new Club look paints the game in your favourite club’s colours, and Auto now follows your phone’s light or dark setting in the app',
        '📖 The Players tab lists all 5,157 Premier League players, with an apps filter and a most-assists sort',
        '📣 Share Goal Machine with your mates from the home screen or Settings',
        '🎧 15 more Soundtrack songs',
        '🗓️ Tidier calendar icon, heading markers and stat buttons',
      ],
    },
    {
      v: 15, label: '4.0', date: '2026-09-25', title: 'Online duels, new modes + fair spins',
      items: [
        '🌐 Play a friend online: a Draft Duel (take turns picking from the same reels) or a Live Race (same spins, watch their total), from the Head to Head banner',
        '⚖️ Fair spins: challenge links and daily games give everyone the same players on the same spin, whatever you picked before',
        '🎛️ Six ways to play the main event: pick the players (⭐ Classic: well-known players more likely, 👑 Ultimate: everyone with 50+ apps equally likely, ⚡ Extreme: every one of the 5,157 PL players) and switch wildcards on or off',
        '💎 Extreme Purist (every PL player, no wildcards) fills its own Purist collection',
        '🔒 Accounts: claim a unique leaderboard name, and move it to a new phone with a transfer code',
        '🎵 Four music tracks: Anthem, Matchday, Thinking Cap and Derby, each for its own part of the game',
        '🎧 Soundtrack: switch the music to real songs on shuffle in ⚙️ Settings, with a skip button',
        '📸 Faces are centred in the circles, player names on the pitch are easier to read, and the draft fits on one screen',
        '👎 The full-time report\'s \'one bad thing\' is a real weakness now, and Dave Watson is no longer a goalkeeper',
      ],
    },
    {
      v: 14, label: '3.1', date: '2026-09-25', title: 'Daily games, streaks + your club',
      items: [
        '🟩 Footle: a new daily game. Guess the mystery Premier League player in 8 tries, with clues on position, nationality, clubs, debut, apps and goals',
        '📅 A Today hub with every daily game, your 🔥 streak (Wordle-style) and a 4-week calendar',
        '💾 Daily games save as you go. Leave half-way and carry on later, then look back at your result until the next day',
        '📊 Daily stars leaderboard: 450+ goal Daily Ultimates, Footle wins, grids completed and the longest streaks',
        '📊 Wordle-style spread of your Ultimate scores: how many 800+, 700+, 600+ teams you\'ve built (on the full-time screen and leaderboards)',
        '🗓️ The daily calendar icon now shows today\'s real date',
        '🏟️ Pick your favourite club in ⚙️ Settings to unlock a daily Club Footle, a Club XI draft (only your club\'s players) and your club\'s colours around the app',
      ],
    },
    {
      v: 13, label: '3.0', date: '2026-09-25', title: 'New look, sound + Head to Head',
      items: [
        '⚔️ Head to Head: pass the phone for a best-of series of random quick games, with the winner lifting the trophy',
        '🎨 A fresh look with a light theme, chunky buttons and colourful game tiles, grouped into Today, Hit the target and Quick games',
        '🌙 Dark mode is optional: choose Light, Dark or Auto (follows your phone) in ⚙️ Settings',
        '🧭 A tab bar at the bottom for Play, Leaderboards, Album and Players',
        '📰 An Updates page (tap 📰 on the home screen) listing what every version brings',
        '⚽ A loading screen and a little buzz on taps (you can switch it off in Settings)',
        '🔊 Sound effects: the referee\'s whistle, spinning reels, the crowd and a goal horn for a bullseye',
        '🎵 Optional background music, a two-minute track (switch it on in ⚙️ Settings)',
        '📸 Far more player faces: older players now get photos from the Premier League archive, Transfermarkt or Wikipedia',
      ],
    },
    {
      v: 12, label: '2.6', date: '2026-09-25', app: 9, title: 'New logo',
      items: [
        '🥅 A new logo: a ball rippling the top corner of the net',
        '🔗 Goal Machine links, such as a friend\'s challenge, open straight in the Android app',
        '📶 A friendly "no signal" screen in the app instead of an error page',
        '📲 The app can now tell you when a newer version is available',
      ],
    },
    {
      v: 11, label: '2.5', date: '2026-09-25', app: 7, title: 'New home',
      items: [
        '🏠 Goal Machine moved to opportunisticgames.github.io. Old links still work and bring your scores and album with them',
        '📲 A new Android app to go with the new address',
      ],
    },
    {
      v: 10, label: '2.4', date: '2026-09-25', title: 'Harder hard mode',
      items: ['🥵 Hard mode in Target, The Treble and Mystery Target now shows far fewer stars on the reels. The targets stay the same'],
    },
    {
      v: 9, label: '2.3', date: '2026-09-25', title: 'The Treble & Mystery Target',
      items: [
        '🏆 The Treble: one XI, three targets (400 goals, 300 assists and 3,300 apps)',
        '🎲 Mystery Target: a random stat and a secret number, with only a thermometer to guide you',
        '🎯 New targets: 500 goals, 350 assists or 3,750 apps',
        '🥵 Hard mode: suggestions show names only in every game',
      ],
    },
    {
      v: 8, label: '2.2', date: '2026-09-25', title: 'Tougher Who Am I?',
      items: ['🕵️ Hard mode Who Am I? suggestions show names only, with no giveaway clues'],
    },
    {
      v: 7, label: '2.1', date: '2026-09-25', title: 'Weekly stats',
      items: ['📊 Player stats refresh automatically every week', '📲 The install button hides once you have the app'],
    },
    {
      v: 6, label: '2.0', date: '2026-09-24', app: 1, title: 'Android app',
      items: ['🤖 Goal Machine for Android: download the APK and play it like any other app'],
    },
    {
      v: 5, label: '1.4', date: '2026-09-24', title: 'Instant updates',
      items: ['⚡ New versions show up straight away instead of hiding behind the old cached one'],
    },
    {
      v: 4, label: '1.3', date: '2026-09-24', title: 'Album & badges',
      items: ['📒 Collect every player you sign, build your Dream XI, complete sets and unlock 34 badges'],
    },
    {
      v: 3, label: '1.2', date: '2026-09-24', title: 'Full-time report',
      items: [
        '📋 Squad rating, tier, one good thing and one bad thing, player badges and chemistry after every draft',
        '🅰️ Assists and appearances versions of every draft',
        '🦘 Club Hopper',
      ],
    },
    {
      v: 2, label: '1.1', date: '2026-09-24', title: 'Ultimate Wildcard',
      items: [
        '👑 Ultimate Wildcard: every player equally likely, biggest total wins, spin until the XI is full',
        '🧩 Real positions (GK, LB, CB, RB, LM, CM, RM, ST) and tap-to-place signings',
        '🥵 Hard mode',
      ],
    },
    {
      v: 1, label: '1.0', date: '2026-09-24', title: 'Kick-off',
      items: [
        '⚽ Goal Machine launches with 2,039 Premier League players (everyone with 50+ apps)',
        '🃏 13 wildcards, a daily challenge, a global leaderboard, Higher or Lower, Who Am I?, Club Grid and Guess the Tally',
      ],
    },
  ];

  // The version this page was loaded as: the ?v= number bump_version.py stamps on the script links
  const tag = document.querySelector('script[src*="js/core.js"]');
  GM.VERSION = +((tag && tag.getAttribute('src').match(/v=(\d+)/)) || [0, GM.UPDATES[0].v])[1];
  GM.appBuild = () => (window.AndroidApp && typeof window.AndroidApp.version === 'function' ? window.AndroidApp.version() : null);
  // the version players see, e.g. 4.1 (see the note at the top)
  GM.versionLabel = (GM.UPDATES.find(u => u.v === GM.VERSION) || GM.UPDATES[0]).label;
  GM.hasUnseenUpdate = () => GM.store.get('seenVersion', 0) < GM.UPDATES[0].v;

  const ERAS = { 1: 'The launch', 2: 'The Android app', 3: 'New look, sound + dailies', 4: 'Online', 5: 'Hat-Trick' };
  const when = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const releaseCard = (u, open) => `<article class="release ${u.v === GM.VERSION || (u.fixes || []).some(f => f.v === GM.VERSION) ? 'current' : ''}">
      <header><span class="ver ${/\.0$/.test(u.label) ? 'major' : ''}">v${u.label}</span><b>${GM.esc(u.title)}</b>
        <small>${when(u.date)}${u.app ? ` · 🤖 App build ${u.app}` : ''}</small></header>
      <ul ${open ? '' : 'class="short"'}>${u.items.map(i => `<li>${i}</li>`).join('')}</ul>
      ${(u.fixes || []).length ? `<details class="fixups"><summary>🔧 ${u.fixes.length} fix-up${u.fixes.length > 1 ? 's' : ''} (v${u.fixes.map(f => f.label).join(', v')})</summary>
        ${u.fixes.map(f => `<p class="fix-head"><b>v${f.label}</b> · ${GM.esc(f.title)} <small>${when(f.date)}</small></p><ul>${f.items.map(i => `<li>${i}</li>`).join('')}</ul>`).join('')}</details>` : ''}</article>`;

  GM.updatesPage = function (root) {
    const build = GM.appBuild();
    // fix-only releases (4.9.1, 4.9.2 …) ride along with the release they patch
    const isFix = u => u.label.split('.').length > 2, base = u => u.label.split('.').slice(0, 2).join('.');
    const releases = GM.UPDATES.filter(u => !isFix(u)).map(u => ({ ...u, fixes: GM.UPDATES.filter(f => isFix(f) && base(f) === u.label) }));
    GM.UPDATES.filter(f => isFix(f) && !releases.some(u => u.label === base(f))).forEach(f => releases.push({ ...f, fixes: [] }));  // an orphan fix-up shows on its own
    releases.sort((a, b) => b.v - a.v);
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>📰 Updates</h2><span></span></div>
      <div class="version-strip">
        <div><small>Game version</small><b>v${GM.versionLabel}</b></div>
        <div><small>${build != null ? 'Android app' : 'Player data'}</small><b>${build != null ? 'Build ' + build : GM.dataDate}</b></div>
      </div>
      ${GM.appOutdated() ? `<a class="btn big" href="${GM.APK_URL}">📲 Get the newest Android app</a>` : ''}
      <p class="muted center">Game updates arrive automatically. The Android app only needs updating when it says <b>🤖 App build</b>.</p>
      <div class="releases">${releases.map((u, i) => {
        const major = u.label.split('.')[0], prev = i && releases[i - 1].label.split('.')[0];
        return (major !== prev ? `<h3 class="section-title era">Version ${major}<span class="more">${ERAS[major] || ''}</span></h3>` : '') + releaseCard(u, i < 3);
      }).join('')}</div>`;
    GM.store.set('seenVersion', GM.UPDATES[0].v);
  };

  // Once per release, players who have played before get a quick "what's new" pop-up
  GM.maybeShowWhatsNew = function () {
    const seen = GM.store.get('seenVersion', 0), latest = GM.UPDATES[0];
    if (seen >= latest.v || location.hash.replace(/^#\/?/, '')) return;  // only on the home screen
    if (!seen && !GM.store.get('played', 0)) { GM.store.set('seenVersion', latest.v); return; }  // brand new player
    // it counts as seen only once it's closed, so a reload (a new version taking over) shows it again
    GM.modal(`<div class="whats-new"><div class="wn-kicker">What's new · v${latest.label}</div><h3>${GM.esc(latest.title)}</h3>
      <ul>${latest.items.map(i => `<li>${i}</li>`).join('')}</ul>
      <div class="row"><a class="btn ghost" href="#/updates" data-close>All updates</a><button class="btn" data-close>Let's play</button></div></div>`, { onClose: () => GM.store.set('seenVersion', latest.v) });
  };
})();
