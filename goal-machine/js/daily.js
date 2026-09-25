/* Goal Machine – daily games: the log and streaks, the Today hub, Footle (guess the player, Wordle-style) and the
   favourite-club features. */
'use strict';

(function () {
  const store = GM.store;
  const esc = GM.esc;

  /* ================================================================ dates */
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
  GM.addDays = addDays;
  GM.untilTomorrow = () => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.round((next - now) / 60000));
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  };

  /* ================================================================ favourite club */
  GM.slug = c => c.toLowerCase().replace(/[^a-z]/g, '');
  GM.favClub = () => { const c = store.get('club', ''); return GM.CLUB[c] || GM.clubs.includes(c) ? c : ''; };
  GM.clubPool = c => GM.players.filter(p => p.clubs.includes(c));
  // Club games need enough players to be fun; every club with 30+ players in the data qualifies
  GM.clubOptions = () => GM.clubs.filter(c => GM.clubPool(c).length >= 30).sort();
  GM.applyClub = function () {
    const c = GM.favClub(), root = document.documentElement;
    if (!c) { root.classList.remove('has-club'); return; }
    const [, bg, fg] = GM.CLUB[c] || [0, '#444', '#fff'];
    // the main colour must carry white text: very light home colours (Spurs, Leeds, Fulham…) use their second colour
    const lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
    const main = lum(bg) > 0.72 ? fg : bg, trim = main === bg ? fg : bg;
    root.style.setProperty('--club-bg', bg);
    root.style.setProperty('--club-fg', fg);
    root.style.setProperty('--club-main', main);
    root.style.setProperty('--club-trim', trim);
    root.style.setProperty('--club-ink', lum(main) > 0.6 ? '#10261d' : '#ffffff');
    // the Club look's accent (buttons, highlights) needs to be bright on a dark background: the lighter club colour,
    // lifted towards white if it's still dark (e.g. navy and white -> white; gold and black -> gold)
    const light = lum(bg) > lum(fg) ? bg : fg;
    root.style.setProperty('--club-light', lum(light) < 0.5 ? `color-mix(in srgb, ${light} 45%, #fff)` : light);
    root.classList.add('has-club');
    if (GM.applyTheme) GM.applyTheme();  // the Club look's bar colour
  };
  GM.setFavClub = c => { store.set('club', c); GM.applyClub(); };
  GM.applyClub();
  // each club gets its own Club XI board names (mode keys are letters only)
  GM.clubs.forEach(c => ['', 'ast', 'apps'].forEach(s => {
    GM.MODES['club' + GM.slug(c) + s] = { name: `${c} XI` + ({ ast: ' – Assists', apps: ' – Apps' }[s] || ''), icon: '🏟️' };
  }));

  /* ================================================================ the daily log + streaks */
  // dlog: { 'YYYY-MM-DD': { daily: 512, grid: 1340, footle: 4 (guesses; 0 = missed), club: 3 } }
  const GAMES = {
    daily: { name: 'Daily Ultimate', get icon() { return GM.calIcon(); }, href: '#/daily', won: v => v != null },
    footle: { name: 'Footle', icon: '🟩', href: '#/footle', won: v => v > 0 },
    grid: { name: 'Daily Club Grid', icon: '#️⃣', href: '#/dailygrid', won: v => v != null },
    club: { name: 'Club Footle', icon: '🏟️', href: '#/clubfootle', won: v => v > 0 },
  };
  GM.DAILY_GAMES = GAMES;
  const log = () => store.get('dlog', {});
  GM.dailyLog = log;
  GM.markDaily = function (game, value, day = GM.today()) {
    const l = log();
    l[day] = { ...(l[day] || {}), [game]: value };
    store.set('dlog', l);
  };
  GM.dailyResult = (game, day = GM.today()) => (log()[day] || {})[game];

  // Wordle-style: consecutive days (up to today, or yesterday if today isn't done yet) that were completed/won
  GM.streak = function (game) {
    const l = log(), ok = day => {
      const e = l[day];
      if (!e) return false;
      return game ? GAMES[game].won(e[game]) : Object.keys(GAMES).some(g => GAMES[g].won(e[g]));
    };
    let day = GM.today(), n = 0;
    if (!ok(day)) {
      if (game && (l[day] || {})[game] != null) return 0;  // lost today: like Wordle, the streak resets
      day = addDays(day, -1);
    }
    while (ok(day)) { n++; day = addDays(day, -1); }
    return n;
  };
  GM.bestStreak = function (game) {
    const days = Object.keys(log()).sort(), l = log();
    let best = 0, run = 0, prev = null;
    for (const d of days) {
      const e = l[d], ok = game ? GAMES[game].won(e[game]) : Object.keys(GAMES).some(g => GAMES[g].won(e[g]));
      if (!ok) { run = 0; prev = d; continue; }
      run = prev && addDays(prev, 1) === d && run ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    }
    return best;
  };

  // one-off: fill the log from games played before it existed
  if (!store.get('dlogFilled', false)) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), m = k && k.match(/^gm:(daily2|hist:grid):(\d{4}-\d{2}-\d{2})$/);
        if (!m) continue;
        const v = JSON.parse(localStorage.getItem(k));
        if (m[1] === 'daily2' && v && v.final) GM.markDaily('daily', v.final.t, m[2]);
        if (m[1] === 'hist:grid' && v && v.length) GM.markDaily('grid', v[0].s, m[2]);
      }
    } catch (e) { }
    store.set('dlogFilled', true);
  }

  // what a daily tile says right now
  GM.dailyStatus = function (game) {
    const v = GM.dailyResult(game);
    const inProgress = {
      daily: () => store.get('dailyp:' + GM.today()), grid: () => { const g = store.get('gridp:' + GM.today()); return g && !g.ended; },
      footle: () => (store.get('footle:' + GM.today()) || {}).guesses, club: () => (store.get('cfootle:' + GM.today() + ':' + GM.slug(GM.favClub())) || {}).guesses,
    }[game];
    if (v != null) {
      const txt = game === 'daily' ? `✓ ${v} goals` : game === 'grid' ? `✓ ${v} pts` : v > 0 ? `✓ Got it in ${v}` : '✗ Missed';
      return { done: true, text: txt };
    }
    if (inProgress && inProgress()) return { done: false, text: '▶ In progress' };
    return { done: false, text: '' };
  };

  /* ================================================================ Today hub */
  GM.todayPage = function (root) {
    const club = GM.favClub(), games = Object.keys(GAMES).filter(g => g !== 'club' || club);
    const l = log(), cal = [];
    for (let i = 27; i >= 0; i--) {
      const d = addDays(GM.today(), -i), e = l[d] || {};
      const n = Object.keys(GAMES).filter(g => GAMES[g].won(e[g])).length;
      cal.push(`<i class="cal-day n${Math.min(n, 3)} ${i === 0 ? 'today' : ''}" title="${d}: ${n} daily game${n === 1 ? '' : 's'}">${+d.slice(8)}</i>`);
    }
    const s = GM.streak();
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>${GM.calIcon()} Today</h2><span></span></div>
      <div class="streak-hero"><div class="flame ${s ? 'lit' : ''}">🔥</div><div><b>${s}</b><span>day streak</span><small>Best ${GM.bestStreak()} · play any daily game to keep it going</small></div></div>
      <div class="daily-list">${games.map(g => {
        const G = GAMES[g], st = GM.dailyStatus(g), gs = GM.streak(g);
        const name = g === 'club' ? `${esc(club)} Footle` : G.name;
        return `<a class="daily-row ${st.done ? 'done' : ''}" href="${G.href}"><span class="dr-icon">${G.icon}</span>
          <span class="dr-text"><b>${name}</b><small>${st.text || (g === 'footle' ? 'Guess the player in 8' : g === 'daily' ? 'Same spins for everyone. One shot.' : g === 'grid' ? 'Played for both? Fill the grid.' : 'Guess the mystery player from your club')}</small></span>
          <span class="dr-streak">${gs ? `🔥${gs}` : ''}</span><span class="dr-go">${st.done ? 'View' : st.text ? 'Continue' : 'Play'}</span></a>`;
      }).join('')}</div>
      ${club ? '' : `<a class="pick-club" href="#/settings">🏟️ Pick your favourite club to unlock a daily <b>Club Footle</b> and your club's colours</a>`}
      <h3 class="section-title">Last 4 weeks</h3>
      <div class="calendar">${cal.join('')}</div>
      <p class="muted center">New daily games in <b>${GM.untilTomorrow()}</b> · <a href="#/leaderboard?m=dailies">📊 Daily leaderboard</a></p>`;
  };

  /* ================================================================ Footle */
  const MAX = 8;
  // well-known players only, and the better known the likelier (a daily puzzle should be gettable)
  const famous = p => p.apps >= 200 || p.goals >= 50;
  function answerFor(day, club) {
    const pool = club ? GM.clubPool(club).filter(p => p.apps >= 60) : GM.players.filter(famous);
    const w = p => club ? Math.sqrt(p.fame) : p.fame, tag = d => 'footle:' + d + (club ? ':' + club : '');
    // no repeats within a month: skip anyone who was the first pick on any of the previous 30 days
    const recent = new Set();
    for (let i = 1; i <= 30; i++) recent.add(GM.rng(tag(addDays(day, -i))).weighted(pool, w).id);
    const r = GM.rng(tag(day));
    for (let tries = 0; tries < 50; tries++) { const p = r.weighted(pool, w); if (!recent.has(p.id)) return p; }
    return r.weighted(pool, w);
  }
  const cmpNum = (g, a, near) => ({ cls: g === a ? 'hit' : Math.abs(g - a) <= near ? 'near' : 'miss', arrow: g === a ? '' : a > g ? '▲' : '▼' });
  function feedback(g, a) {
    const sharedClubs = g.clubs.filter(c => a.clubs.includes(c));
    const sameClubs = sharedClubs.length === a.clubs.length && g.clubs.length === a.clubs.length;
    return {
      pos: { cls: g.poss[0] === a.poss[0] ? 'hit' : g.poss.some(x => a.poss.includes(x)) || g.pos === a.pos ? 'near' : 'miss', txt: g.poss[0] },
      nat: { cls: g.nat && g.nat === a.nat ? 'hit' : 'miss', txt: GM.flag(g.nat) },
      clubs: { cls: sameClubs ? 'hit' : sharedClubs.length ? 'near' : 'miss', txt: sharedClubs.length ? sharedClubs.map(GM.clubShort).slice(0, 2).join(' ') : g.clubs.length + ' club' + (g.clubs.length > 1 ? 's' : '') },
      first: { ...cmpNum(g.first, a.first, 2), txt: "'" + String(g.first).slice(2) },
      apps: { ...cmpNum(g.apps, a.apps, 30), txt: g.apps },
      goals: { ...cmpNum(g.goals, a.goals, 10), txt: g.goals },
    };
  }
  const COLS = [['pos', 'Pos'], ['nat', 'Nat'], ['clubs', 'Clubs'], ['first', 'Debut'], ['apps', 'Apps'], ['goals', 'Goals']];
  const EMOJI = { hit: '🟩', near: '🟨', miss: '⬛' };
  const isAnswer = (g, a) => g.id === a.id || (g.name === a.name && g.first === a.first);
  GM.footleAnswer = answerFor;  // for tests

  GM.footle = function (root, clubMode) {
    const club = clubMode ? GM.favClub() : '';
    if (clubMode && !club) { location.hash = '#/settings'; GM.toast('Pick your favourite club first'); return; }
    const day = GM.today(), key = clubMode ? `cfootle:${day}:${GM.slug(club)}` : 'footle:' + day, game = clubMode ? 'club' : 'footle';
    const ans = answerFor(day, club);
    const st = store.get(key, { guesses: [] });
    const guesses = () => st.guesses.map(id => GM.players[id]);
    const title = clubMode ? `${esc(club)} Footle` : 'Footle';

    function row(g) {
      const f = feedback(g, ans);
      return `<div class="f-row ${isAnswer(g, ans) ? 'win' : ''}"><div class="f-name">${GM.avatar(g)}<b>${esc(g.name)}</b></div>
        <div class="f-cells">${COLS.map(([k]) => `<span class="f-cell ${f[k].cls}">${f[k].txt}${f[k].arrow ? `<i>${f[k].arrow}</i>` : ''}</span>`).join('')}</div></div>`;
    }
    function render() {
      const gs = guesses(), won = gs.some(g => isAnswer(g, ans)), over = won || gs.length >= MAX;
      root.innerHTML = `<div class="topbar"><a href="#/today" class="back">‹</a><h2>🟩 ${title}</h2><button class="icon-btn small" id="fhelp">?</button></div>
        <div class="hl-head">Guess ${Math.min(gs.length + (over ? 0 : 1), MAX)} of ${MAX}${clubMode ? ` · every answer played for ${esc(club)}` : ' · a well-known PL player'}</div>
        ${over ? '' : `<div class="guess-box"><input class="input" id="fg" placeholder="Type a player…" autocomplete="off"><div class="ac" id="fac" hidden></div></div>`}
        <div class="f-head"><span></span><div class="f-cells">${COLS.map(([, l]) => `<span>${l}</span>`).join('')}</div></div>
        <div class="f-rows">${gs.slice().reverse().map(row).join('') || '<p class="muted center">Green is a match. Yellow is close (a shared club, a similar position, or within a few seasons, 30 apps or 10 goals). The arrows say whether the answer is higher or lower.</p>'}</div>
        <div id="fover"></div>`;
      GM.$('#fhelp', root).onclick = help;
      if (over) return result(won);
      const inp = GM.$('#fg', root);
      GM.autocomplete(inp, GM.$('#fac', root), guess, { exclude: p => st.guesses.includes(p.id) });
      setTimeout(() => inp.focus(), 30);
    }
    function guess(p) {
      st.guesses.push(p.id);
      store.set(key, st);
      const won = isAnswer(p, ans);
      GM.sound.play(won ? 'good' : 'place'); GM.buzz();
      if (won || st.guesses.length >= MAX) {
        const n = won ? st.guesses.length : 0;
        GM.markDaily(game, n, day);
        if (!clubMode && won) GM.recordScore('footle:' + day, MAX + 1 - n);
        setTimeout(() => GM.sound.play(won ? 'cheer' : 'fulltime'), 250);
      }
      render();
    }
    function result(won) {
      const gs = guesses(), n = gs.length;
      const grid = gs.map(g => { const f = feedback(g, ans); return COLS.map(([k]) => EMOJI[f[k].cls]).join(''); }).join('\n');
      const share = `⚽ ${clubMode ? club + ' ' : ''}Footle ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${won ? n : 'X'}/${MAX}\n${grid}`;
      const l = log(), dist = Array(MAX + 1).fill(0);
      let played = 0, wins = 0;
      Object.values(l).forEach(e => { if (e[game] != null) { played++; if (e[game] > 0) { wins++; dist[e[game]]++; } } });
      const mx = Math.max(1, ...dist);
      GM.$('#fover', root).innerHTML = `<div class="result f-result">
        <div class="center">${GM.avatar(ans, 'lg')}<h3>${won ? '🎉 ' : ''}${esc(ans.name)}</h3>
          <p class="muted">${ans.poss.join('/')} · ${GM.flag(ans.nat)} · ${GM.era(ans)} · ${ans.apps} apps · ${ans.goals} goals</p>
          <div class="chips">${ans.clubs.map(c => GM.clubChip(c)).join('')}</div></div>
        <div class="f-stats"><div><b>${played}</b><small>Played</small></div><div><b>${played ? Math.round(100 * wins / played) : 0}%</b><small>Won</small></div>
          <div><b>${GM.streak(game)}</b><small>Streak</small></div><div><b>${GM.bestStreak(game)}</b><small>Best</small></div></div>
        <div class="f-dist">${dist.slice(1).map((c, i) => `<div><span>${i + 1}</span><i style="width:${Math.max(6, 100 * c / mx)}%" class="${won && n === i + 1 ? 'me' : ''}">${c}</i></div>`).join('')}</div>
        <div class="actions col"><button class="btn big" id="fshare">📤 Share</button><a class="btn ghost" href="#/today">📅 Other daily games</a></div>
        <p class="muted center">Next ${title} in ${GM.untilTomorrow()}</p></div>`;
      GM.$('#fshare', root).onclick = () => GM.share(share, GM.baseUrl() + (clubMode ? '#/clubfootle' : '#/footle'));
    }
    function help() {
      GM.modal(`<h3>How to play ${title}</h3><p>Guess today's mystery Premier League player in ${MAX} tries. After each guess the tiles show how close you are:</p>
        <ul><li><b>Pos</b>: main position. 🟩 same, 🟨 can play there or same area of the pitch</li><li><b>Nat</b>: nationality</li>
        <li><b>Clubs</b>: 🟩 exactly the same PL clubs, 🟨 at least one in common (shown)</li>
        <li><b>Debut</b>: first PL season. 🟨 within 2 seasons; ▲ means the answer is later</li>
        <li><b>Apps / Goals</b>: PL totals. 🟨 within 30 apps or 10 goals; ▲ means the answer has more</li></ul>
        <p>Everyone gets the same player each day. Win in a row to build your streak.</p><div class="row"><button class="btn" data-close>Got it</button></div>`);
    }
    render();
  };

  /* ================================================================ daily leaderboard (Supabase view) */
  GM.lb.dailyBoard = async function (sort) {
    const cfg = GM.lb.cfg;
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/daily_board?select=*&order=${sort}.desc,days_played.desc&limit=25`, { headers: GM.lb.headers() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };
})();
