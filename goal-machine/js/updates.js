/* Goal Machine – what's new. Add an entry at the top for every release.
   v     = the ?v= number in index.html (bumped by tools/bump_version.py on every release; phones use it to fetch fresh files)
   label = the version players see. A new whole number for a big change to how the game plays (1 launch, 2 Android app,
           3 new look, 4 online); otherwise the next .1 (4.1, 4.2 …). Small fixes can share the next release's entry. */
'use strict';

(function () {
  GM.UPDATES = [
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

  const ERAS = { 1: 'The launch', 2: 'The Android app', 3: 'New look, sound + dailies', 4: 'Online' };
  const releaseCard = (u, open) => `<article class="release ${u.v === GM.VERSION ? 'current' : ''}">
      <header><span class="ver ${/\.0$/.test(u.label) ? 'major' : ''}">v${u.label}</span><b>${GM.esc(u.title)}</b>
        <small>${new Date(u.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}${u.app ? ` · 🤖 App build ${u.app}` : ''}</small></header>
      <ul ${open ? '' : 'class="short"'}>${u.items.map(i => `<li>${i}</li>`).join('')}</ul></article>`;

  GM.updatesPage = function (root) {
    const build = GM.appBuild();
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>📰 Updates</h2><span></span></div>
      <div class="version-strip">
        <div><small>Game version</small><b>v${GM.versionLabel}</b></div>
        <div><small>${build != null ? 'Android app' : 'Player data'}</small><b>${build != null ? 'Build ' + build : GM.dataDate}</b></div>
      </div>
      ${GM.appOutdated() ? `<a class="btn big" href="${GM.APK_URL}">📲 Get the newest Android app</a>` : ''}
      <p class="muted center">Game updates arrive automatically. The Android app only needs updating when it says <b>🤖 App build</b>.</p>
      <div class="releases">${GM.UPDATES.map((u, i) => {
        const major = u.label.split('.')[0], prev = i && GM.UPDATES[i - 1].label.split('.')[0];
        return (major !== prev ? `<h3 class="section-title era">Version ${major}<span class="more">${ERAS[major] || ''}</span></h3>` : '') + releaseCard(u, i < 3);
      }).join('')}</div>`;
    GM.store.set('seenVersion', GM.UPDATES[0].v);
  };

  // Once per release, players who have played before get a quick "what's new" pop-up
  GM.maybeShowWhatsNew = function () {
    const seen = GM.store.get('seenVersion', 0), latest = GM.UPDATES[0];
    if (seen >= latest.v || location.hash.replace(/^#\/?/, '')) return;  // only on the home screen
    if (!seen && !GM.store.get('played', 0)) { GM.store.set('seenVersion', latest.v); return; }  // brand new player
    GM.store.set('seenVersion', latest.v);
    GM.modal(`<div class="whats-new"><div class="wn-kicker">What's new · v${latest.label}</div><h3>${GM.esc(latest.title)}</h3>
      <ul>${latest.items.map(i => `<li>${i}</li>`).join('')}</ul>
      <div class="row"><a class="btn ghost" href="#/updates" data-close>All updates</a><button class="btn" data-close>Let's play</button></div></div>`);
  };
})();
