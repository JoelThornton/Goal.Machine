/* Goal Machine – the Album: players you've signed, your Dream XI, collectable sets and achievement badges */
'use strict';

(function () {
  // Two books: the Album (players with 50+ PL apps, plus badges) and the Purist collection (every PL player, filled
  // only by Purist drafts). Players are keyed "name|first season", which stays put when the weekly data refresh
  // re-orders the list; albums saved with list positions are converted once.
  const load = (book = 'album') => {
    const a = GM.store.get(book, { players: {}, ach: {}, days: [] });
    // by: the players signed in each stat's games, with how many times (so the goals Dream XI needs goals-mode signings).
    // Albums from before v4.2 didn't record the stat, so everyone collected then counts once in all three.
    if (!a.by) { const once = Object.fromEntries(Object.keys(a.players).map(k => [k, 1])); a.by = { goals: { ...once }, assists: { ...once }, apps: { ...once } }; }
    const keys = Object.keys(a.players);
    if (book === 'album' && keys.length && keys.every(k => /^\d+$/.test(k))) {
      const moved = {};
      keys.forEach(k => { const p = GM.players[+k]; if (p) moved[p.pk] = a.players[k]; });
      a.players = moved;
      GM.store.set(book, a);
    }
    return a;
  };
  const save = (a, book = 'album') => GM.store.set(book, a);
  const bookList = book => (book === 'purist' ? GM.allPlayers || [] : GM.players);
  const fmt = n => n.toLocaleString();

  /* ---------------------------------------------------------------- achievements */
  // ev: { type: 'draft', mode, stat, total, hard, xi: [players], rating, pairs, wildUsed, coinWin, bull, closeness }
  //  or { type: 'game', mode, score, extra }
  const A = [
    // drafts
    ['first', '🥅', 'First XI', 'Finish your first draft.', e => e.type === 'draft'],
    ['ult300', '🥉', '300 Club', 'Score 300+ goals in Ultimate Wildcard.', e => ult(e, 'goals') && e.total >= 300],
    ['ult400', '🥈', '400 Club', 'Score 400+ goals in Ultimate Wildcard.', e => ult(e, 'goals') && e.total >= 400],
    ['ult500', '🥇', 'Goal Machine', 'Score 500+ goals in Ultimate Wildcard.', e => ult(e, 'goals') && e.total >= 500],
    ['ast250', '🅰️', 'Creator', 'Build an XI with 250+ assists in Ultimate Wildcard.', e => ult(e, 'assists') && e.total >= 250],
    ['apps4000', '🏃', 'Iron Men', 'Build an XI with 4,000+ apps in Ultimate Wildcard.', e => ult(e, 'apps') && e.total >= 4000],
    ['bull', '🎯', 'Bullseye', 'Hit a Target exactly.', e => e.type === 'draft' && e.bull && e.mode === 'target'],
    ['treble', '🏆', 'Treble Winners', 'Win the Treble – goals, assists and apps all within 3%.', e => e.type === 'draft' && e.treble],
    ['mystery', '🎲', 'Mystery Solved', 'Finish within 2% of a Mystery Target.', e => e.type === 'draft' && e.mode === 'mystery' && e.closeness <= 10],
    ['close', '📏', 'Near Miss', 'Finish within 2% of a Target.', e => e.type === 'draft' && e.mode === 'target' && e.closeness != null && e.closeness <= 10],
    ['contenders', '🏆', 'Title Race', 'Get a Title contenders squad rating (or better).', e => e.type === 'draft' && e.rating >= 80],
    ['invincible', '👑', 'Invincibles', 'Get an Invincibles squad rating.', e => e.type === 'draft' && e.rating >= 88],
    ['relegated', '☠️', 'Dead Rubber', 'Finish with a Relegation certainties squad. It happens.', e => e.type === 'draft' && e.rating < 55],
    ['chem5', '🤝', 'Band of Brothers', 'Have 5+ pairs of former teammates in one XI.', e => e.type === 'draft' && e.pairs >= 5],
    ['hof3', '🏛️', 'Hall of Fame XI', 'Sign 3+ Hall of Famers in one XI.', e => e.type === 'draft' && e.xi.filter(p => p.hon.H).length >= 3],
    ['wc2', '🌍', 'World Champions', 'Sign 2+ World Cup winners in one XI.', e => e.type === 'draft' && e.xi.filter(p => p.hon.W).length >= 2],
    ['club5', '🏟️', 'Club Legends', 'Have 5+ players from the same club in one XI.', e => e.type === 'draft' && maxSameClub(e.xi) >= 5],
    ['wild5', '🃏', 'Wildcard Wizard', 'Use 5 wildcards in one game.', e => e.type === 'draft' && e.wildUsed >= 5],
    ['coin', '🎲', 'Fortune Favours', 'Win a Double or Nothing coin toss.', e => e.type === 'draft' && e.coinWin],
    ['chaos', '🌪️', 'Agent of Chaos', 'Score 500+ points in Ultimate Wildcard CHAOS (goals).', e => e.type === 'draft' && e.mode === 'chaos' && e.stat === 'goals' && e.points >= 500],
    ['hard', '🥵', 'No Clues', 'Finish a draft in Hard mode.', e => e.type === 'draft' && e.hard],
    ['daily3', '📅', 'Regular', 'Play the Daily Ultimate 3 days in a row.', (e, a) => streak(a.days) >= 3],
    ['daily7', '🗓️', 'Season Ticket', 'Play the Daily Ultimate 7 days in a row.', (e, a) => streak(a.days) >= 7],
    // other games
    ['hop10', '🦘', 'Globetrotter', 'Make 10 hops in Club Hopper.', e => game(e, 'hopper') && e.score >= 10],
    ['hop20', '✈️', 'Frequent Flyer', 'Make 20 hops in Club Hopper.', e => game(e, 'hopper') && e.score >= 20],
    ['hilo10', '↕️', 'Streaker', 'Get 10 in a row in Higher or Lower.', e => game(e, 'hilo') && e.score >= 10],
    ['hilo25', '🔥', 'On Fire', 'Get 25 in a row in Higher or Lower.', e => game(e, 'hilo') && e.score >= 25],
    ['who3000', '🕵️', 'Detective', 'Score 3,000+ in Who Am I?', e => game(e, 'whoami') && e.score >= 3000],
    ['grid', '#️⃣', 'Full House', 'Fill a whole Club Grid.', e => game(e, 'grid') && e.extra && e.extra.full],
    ['tally700', '🔢', 'Human Calculator', 'Score 700+ in Guess the Tally.', e => game(e, 'tally') && e.score >= 700],
    // collecting
    ['col100', '📒', 'Scout', 'Collect 100 players.', (e, a) => Object.keys(a.players).length >= 100],
    ['col500', '🔭', 'Chief Scout', 'Collect 500 players.', (e, a) => Object.keys(a.players).length >= 500],
    ['col1000', '📚', 'Encyclopedia', 'Collect 1,000 players.', (e, a) => Object.keys(a.players).length >= 1000],
    ['hofall', '🏛️', 'Pantheon', 'Collect every Hall of Famer.', (e, a) => setDone(a, 'hof')],
    ['gball', '👟', 'Boot Room', 'Collect every Golden Boot winner.', (e, a) => setDone(a, 'boot')],
  ].map(([id, icon, name, desc, test]) => ({ id, icon, name, desc, test }));

  const ult = (e, stat) => e.type === 'draft' && (e.mode === 'ultimate' || e.mode === 'daily') && e.stat === stat;
  const game = (e, m) => e.type === 'game' && e.mode.replace(/h$/, '').replace(/:.*/, '') === m;
  function maxSameClub(xi) {
    const c = {};
    xi.forEach(p => p.clubs.forEach(k => { c[k] = (c[k] || 0) + 1; }));
    return Math.max(0, ...Object.values(c));
  }
  function streak(days) {
    const set = new Set(days);
    let n = 0;
    const d = new Date();
    for (;;) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!set.has(k)) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* ---------------------------------------------------------------- sets */
  const SETS = [
    { id: 'hof', icon: '🏛️', name: 'Hall of Fame', test: p => p.hon.H },
    { id: 'boot', icon: '👟', name: 'Golden Boot winners', test: p => p.hon.B },
    { id: 'wc', icon: '🌍', name: 'World Cup winners', test: p => p.hon.W },
    { id: 'cl', icon: '⭐', name: 'Champions League winners', test: p => p.hon.C },
    { id: '100', icon: '💯', name: '100 Club', test: p => p.goals >= 100 },
    { id: 'one', icon: '❤️', name: 'One-club men (150+ apps)', test: p => p.clubs.length === 1 && p.apps >= 150 },
  ];
  const setMembers = {};
  SETS.forEach(s => { setMembers[s.id] = GM.players.filter(s.test).map(p => p.id); });
  const setDone = (a, id) => setMembers[id].every(i => a.players[GM.players[i].pk]);

  function check(ev, a) {
    const fresh = [];
    for (const x of A) {
      if (a.ach[x.id]) continue;
      let ok = false;
      try { ok = x.test(ev, a); } catch (err) { ok = false; }
      if (ok) { a.ach[x.id] = GM.today(); fresh.push(x); }
    }
    return fresh;
  }

  function celebrate(fresh, newPlayers) {
    let delay = 600;
    fresh.forEach(x => { setTimeout(() => GM.toast(`🏅 Badge unlocked: ${x.icon} <b>${x.name}</b>`, 2600), delay); delay += 2800; });
    const stars = newPlayers.filter(p => p.hon.H || p.hon.B || p.goals >= 100);
    if (stars.length) setTimeout(() => GM.toast(`📒 Collected ${stars.slice(0, 2).map(p => GM.esc(p.name)).join(' & ')}${stars.length > 2 ? ` +${stars.length - 2}` : ''}!`, 2600), delay);
  }

  /** Called when a draft finishes. Adds the XI to the album and checks badges. */
  GM.collectDraft = function (ev) {
    const a = load();
    const purist = ev.mode === 'purist', book = purist ? load('purist') : a;
    const newPlayers = [];
    const statBook = book.by[GM.STATS[ev.stat] ? ev.stat : 'goals'];
    ev.xi.forEach(p => {
      if (!purist && !GM.byPk.has(p.pk)) return;  // Extreme's lesser-known players belong to the Purist collection only
      if (!book.players[p.pk]) { book.players[p.pk] = GM.today(); newPlayers.push(p); }
      statBook[p.pk] = (statBook[p.pk] || 0) + 1;
    });
    if (ev.mode === 'daily' && !a.days.includes(GM.today())) a.days = a.days.concat(GM.today()).slice(-60);
    const fresh = check({ type: 'draft', ...ev }, a);
    save(a);
    if (purist) save(book, 'purist');
    celebrate(fresh, newPlayers);
    return { newPlayers, fresh, total: Object.keys(book.players).length, book: purist ? 'purist' : 'album' };
  };

  /** Called when any other game finishes. */
  GM.checkGame = function (mode, score, extra) {
    const a = load();
    const fresh = check({ type: 'game', mode, score, extra }, a);
    if (fresh.length) { save(a); celebrate(fresh, []); }
  };

  GM.albumSummary = function () {
    const a = load();
    return { players: Object.keys(a.players).length, badges: Object.keys(a.ach).length, totalBadges: A.length,
      purist: Object.keys(GM.store.get('purist', { players: {} }).players).length };
  };

  /* ---------------------------------------------------------------- who you pick */
  // picks: { p: { "name|first": [times offered, times signed] }, c: { club: signings } } – every draft reel counts
  GM.trackPick = function (picked, offered) {
    const t = GM.store.get('picks', { p: {}, c: {} });
    offered.forEach(p => { if (p) { const e = t.p[p.pk] || (t.p[p.pk] = [0, 0]); e[0]++; } });
    if (picked) {
      const e = t.p[picked.pk] || (t.p[picked.pk] = [1, 0]);
      e[1]++;
      picked.clubs.forEach(c => { t.c[c] = (t.c[c] || 0) + 1; });
    }
    GM.store.set('picks', t);
  };
  GM.pickCount = pk => ((GM.store.get('picks', { p: {} }).p[pk] || [0, 0]));
  const findPk = pk => GM.byPk.get(pk) || (GM.allPlayers || []).find(p => p.pk === pk);
  function picksHtml() {
    const t = GM.store.get('picks', { p: {}, c: {} }), rows = Object.entries(t.p);
    if (!rows.length) return '';
    const signed = rows.filter(([, [, n]]) => n > 0), total = signed.reduce((a, [, [, n]]) => a + n, 0);
    const list = (arr, fmtRow) => arr.map(([k, v]) => { const p = findPk(k); return p ? `<li>${GM.avatar(p)}<b>${GM.esc(p.name)}</b><span>${fmtRow(v)}</span></li>` : ''; }).join('');
    const loved = signed.slice().sort((a, b) => b[1][1] - a[1][1] || a[1][0] - b[1][0]).slice(0, 5);
    // snubbed: offered most without ever being signed
    const snubbed = rows.filter(([, [o, n]]) => n === 0 && o >= 2).sort((a, b) => b[1][0] - a[1][0]).slice(0, 5);
    const clubs = Object.entries(t.c).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<h3 class="section-title">📊 Your picks</h3>
      <div class="album-head"><div><b>${fmt(total)}</b><small>signings</small></div><div><b>${fmt(signed.length)}</b><small>different players</small></div></div>
      <div class="picks">
        <div><h4>❤️ Your favourites</h4><ol>${list(loved, ([o, n]) => `signed ×${n}`)}</ol></div>
        ${snubbed.length ? `<div><h4>🙅 Always snubbed</h4><ol>${list(snubbed, ([o]) => `passed over ×${o}`)}</ol></div>` : ''}
        <div><h4>🏟️ Clubs you sign from</h4><ol>${clubs.map(([c, n]) => `<li>${GM.clubChip(c)}<b>${GM.esc(c)}</b><span>${n}</span></li>`).join('')}</ol></div>
      </div>`;
  }

  /* ---------------------------------------------------------------- dream XI */
  const SLOTS = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  function dreamXI(have, key) {
    have = have.slice().sort((x, y) => y[key] - x[key]);
    const used = new Set();
    // fill scarcest positions first so utility players don't block them
    const order = [0, 1, 4, 5, 8, 2, 3, 6, 7, 9, 10];
    const xi = [];
    order.forEach(k => {
      const p = have.find(q => !used.has(q.id) && q.poss.includes(SLOTS[k]));
      if (p) used.add(p.id);
      xi[k] = { pos: SLOTS[k], player: p || null };
    });
    return xi;
  }

  /* ---------------------------------------------------------------- album page */
  GM.album = function (root, statId = 'goals', book = 'album') {
    const purist = book === 'purist';
    if (purist && !GM.allPlayers) {
      root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>💎 Purist collection</h2><span></span></div><div class="loading-all"><div class="splash-bar"><i></i></div></div>`;
      GM.loadAll().then(() => { if (location.hash.includes('b=purist')) GM.album(root, statId, book); });
      return;
    }
    const a = load(book), list = bookList(book);
    const index = purist ? new Map(list.map(p => [p.pk, p])) : GM.byPk;
    const mine = Object.keys(a.players).map(k => index.get(k)).filter(Boolean);
    const has = p => !!a.players[p.pk];
    const ids = mine;
    const st = GM.STATS[statId];
    const got = a.by[statId] || {};
    const xi = dreamXI(mine.filter(p => got[p.pk]), st.key);
    const tot = xi.reduce((t, s) => t + (s.player ? s.player[st.key] : 0), 0);
    const rows = [['ST'], ['LM', 'CM', 'RM'], ['LB', 'CB', 'RB'], ['GK']];
    const rowOf = pos => rows.findIndex(r => r.includes(pos));
    const lines = [0, 1, 2, 3].map(r => xi.map((s, i) => [s, i]).filter(([s]) => rowOf(s.pos) === r));
    const slot = s => s.player
      ? `<div class="slot filled" title="${GM.esc(s.player.name)}">${GM.avatar(s.player)}<span class="slot-name">${GM.esc(s.player.name.split(' ').slice(-1)[0])}</span><span class="slot-goals">${fmt(s.player[st.key])}</span><span class="slot-pos">${s.pos}</span>${got[s.player.pk] > 1 ? `<span class="slot-times">×${got[s.player.pk]}</span>` : ''}</div>`
      : `<div class="slot empty"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span></div>`;
    const clubSets = GM.clubs.map(c => {
      const members = list.filter(p => p.clubs.includes(c));
      return [c, members.filter(has).length, members.length];
    }).sort((x, y) => y[1] / y[2] - x[1] / x[2] || y[2] - x[2]);
    const bar = (have, all) => `<div class="bar"><i style="width:${all ? have / all * 100 : 0}%"></i></div>`;
    const recent = Object.entries(a.players).sort((x, y) => (y[1] > x[1] ? 1 : -1)).slice(0, 18).map(([k]) => index.get(k)).filter(Boolean);
    const main = load();

    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>${purist ? '💎 Purist collection' : '📒 Album'}</h2><span></span></div>
      <div class="hard-toggle small"><a class="${purist ? '' : 'on'}" href="#/album">📒 Album</a><a class="${purist ? 'on' : ''}" href="#/album?b=purist">💎 Purist</a></div>
      <div class="album-head">
        <div><b>${fmt(ids.length)}</b><small>of ${fmt(list.length)} players</small></div>
        <div>${purist ? `<b>${list.length ? (100 * ids.length / list.length).toFixed(1) : 0}%</b><small>of every PL player</small>` : `<b>${Object.keys(main.ach).length}</b><small>of ${A.length} badges</small>`}</div>
      </div>
      ${bar(ids.length, list.length)}
      <p class="muted center">${purist ? 'The purist\'s album: every one of the ' + fmt(list.length) + ' players to play in the Premier League, collected only through <a href="#/draft?m=purist">💎 Purist</a> drafts (no wildcards, everyone equally likely).'
        : 'Every player you sign in a draft is added to your album. Stored on this device.'}</p>

      <h3 class="section-title">⭐ Your Dream XI</h3>
      <p class="muted">Your best player in every position, from players you've signed in ${st.name.toLowerCase()} games (×2, ×3… is how many times you've signed him). ${fmt(Object.keys(got).length)} players in your ${st.name.toLowerCase()} book.</p>
      <div class="hard-toggle small three">${Object.entries(GM.STATS).map(([k, s]) => `<a class="${k === statId ? 'on' : ''}" href="#/album?s=${k}${purist ? '&b=purist' : ''}">${s.icon} ${s.name}</a>`).join('')}</div>
      <div class="pitch"><div class="pitch-lines"></div><div class="shape">${fmt(tot)} ${st.label}</div>
        ${lines.map(l => `<div class="pitch-row">${l.map(([s]) => slot(s)).join('')}</div>`).join('')}</div>

      ${purist ? '' : `<h3 class="section-title">🏅 Badges</h3>
      <div class="ach-grid">${A.map(x => `<div class="ach ${a.ach[x.id] ? 'got' : ''}" title="${GM.esc(x.desc)}">
        <span class="ach-icon">${a.ach[x.id] ? x.icon : '🔒'}</span><b>${x.name}</b><small>${x.desc}</small></div>`).join('')}</div>`}

      ${purist ? '' : picksHtml()}
      <h3 class="section-title">🗂️ Sets</h3>
      <div class="sets">${SETS.map(s => {
        const m = setMembers[s.id].map(i => GM.players[i]), have = m.filter(has);
        return `<details class="set"><summary><span>${s.icon} ${s.name}</span><span>${have.length}/${m.length}</span>${bar(have.length, m.length)}</summary>
          <div class="set-list">${m.sort((x, y) => y.fame - x.fame).map(p => `<span class="${has(p) ? 'have' : ''}">${has(p) ? '✅' : '▫️'} ${GM.esc(p.name)}</span>`).join('')}</div></details>`;
      }).join('')}</div>

      <details class="set clubs-block"><summary><span>🏟️ Clubs</span><span>${clubSets.filter(([, h, n]) => h === n).length}/${clubSets.length} complete</span></summary>
        <div class="sets">${clubSets.map(([c, h, n]) => `<div class="club-set">${GM.clubChip(c)}<span>${GM.esc(c)}</span><span>${h}/${n}</span>${bar(h, n)}</div>`).join('')}</div></details>

      ${recent.length ? `<h3 class="section-title">🆕 Recently collected</h3><div class="team-badges">${recent.map(p => `<span>${GM.esc(p.name)}</span>`).join('')}</div>` : ''}`;
  };
})();
