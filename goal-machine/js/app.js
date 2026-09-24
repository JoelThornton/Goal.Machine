/* Goal Machine – router, home screen, leaderboard, player index */
'use strict';

(function () {
  const app = GM.$('#app');
  let installEvt = null;

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; const b = GM.$('#install'); if (b) b.hidden = false; });

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { path: path || '', q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  function route() {
    const { path, q } = parseHash();
    window.scrollTo(0, 0);
    GM.$$('.modal-wrap').forEach(m => m.remove());
    app.className = 'page-' + (path || 'home');
    switch (path) {
      case 'draft': return GM.draft.start(app, q.m === 'target' ? 'target' : 'ultimate',
        { stat: q.s, seed: q.seed, vs: q.vs, vss: q.vss ? +q.vss : undefined, hard: q.seed ? q.h === '1' : GM.isHard() });
      case 'daily': return GM.draft.start(app, 'daily');
      case 'hilo': return GM.hilo(app);
      case 'hopper': return GM.hopper(app);
      case 'whoami': return GM.whoami(app);
      case 'grid': return GM.grid(app, false);
      case 'dailygrid': return GM.grid(app, true);
      case 'tally': return GM.tally(app);
      case 'leaderboard': return leaderboard(q.m);
      case 'players': return playerIndex();
      case 'about': return about();
      default: return home();
    }
  }

  /* ---------------------------------------------------------------- home */
  function home() {
    const dailyDone = GM.store.get('daily2:' + GM.today());
    const gridDone = GM.store.get('hist:grid:' + GM.today(), []).length > 0;
    const hard = GM.isHard();
    const pb = k => GM.best(hard && GM.HARD_MODES.includes(k) ? k + 'h' : k);
    const statBtn = (m, s, label) => {
      const st = GM.STATS[s], best = pb(GM.draft.modeKey(m, s, false));
      return `<a class="stat-btn" href="#/draft?m=${m}&s=${s}">${st.icon} ${label || st.name}${best ? `<small>PB ${best.toLocaleString()}</small>` : ''}</a>`;
    };
    const card = (href, icon, title, sub, best, extra = '') =>
      `<a class="mode-card ${extra}" href="${href}"><span class="mode-icon">${icon}</span><span class="mode-text"><b>${title}</b><small>${sub}</small></span>${best != null ? `<span class="pb">${best ? 'PB ' + best : ''}</span>` : ''}</a>`;
    app.innerHTML = `
      <header class="hero">
        <div class="logo">GOAL<span>MACHINE</span></div>
        <p>${GM.players.length.toLocaleString()} Premier League players · every one with 50+ apps · 1992 to today</p>
        <button class="btn small" id="install" hidden>📲 Install app</button>
      </header>
      <div class="hard-toggle" role="group" aria-label="Difficulty">
        <button class="${hard ? '' : 'on'}" data-hard="0">🙂 Normal<small>clubs, years &amp; apps shown</small></button>
        <button class="${hard ? 'on' : ''}" data-hard="1">🥵 Hard<small>names &amp; positions only</small></button>
      </div>
      <div class="mode-card featured ultimate big-card">
        <span class="mode-icon">👑</span>
        <span class="mode-text"><b>Ultimate Wildcard</b><small>Build the XI with the biggest total. Every player equally likely – find the stars among the journeymen.</small>
          <span class="stat-pick">${statBtn('ultimate', 'goals')}${statBtn('ultimate', 'assists')}${statBtn('ultimate', 'apps')}</span></span>
      </div>
      <section class="cards">
        ${card('#/daily', '📅', 'Daily Ultimate', dailyDone ? `Done today – ${dailyDone.final ? dailyDone.final.t + ' goals' : ''} · back tomorrow` : 'Same spins for everyone today. One shot. Most goals wins.', null, dailyDone ? 'done' : '')}
        <div class="mode-card">
          <span class="mode-icon">🎯</span>
          <span class="mode-text"><b>Target</b><small>Hit the number exactly for a bullseye.</small>
            <span class="stat-pick">${statBtn('target', 'goals', '442 goals')}${statBtn('target', 'assists', '333 assists')}${statBtn('target', 'apps', '3,500 apps')}</span></span>
        </div>
      </section>
      <h3 class="section-title">More games</h3>
      <section class="cards">
        ${card('#/hopper', '🦘', 'Club Hopper', 'Hop from club to club through players. 90 seconds.', GM.best('hopper'))}
        ${card('#/hilo', '↕️', 'Higher or Lower', 'More goals? More apps? Keep the streak', pb('hilo'))}
        ${card('#/whoami', '🕵️', 'Who Am I?', 'Guess the player from the clues', pb('whoami'))}
        ${card('#/dailygrid', '#️⃣', gridDone ? 'Daily Club Grid ✓' : 'Daily Club Grid', 'Played for both? 3×3 grid', GM.best('grid'))}
        ${card('#/grid', '🔀', 'Random Club Grid', 'Endless grids', null)}
        ${card('#/tally', '🔢', 'Guess the Tally', 'How many PL goals did he score?', pb('tally'))}
      </section>
      <section class="cards">
        ${card('#/leaderboard', '🏆', 'Leaderboards', GM.lb.enabled ? 'Global + your bests' : 'Your best scores', null)}
        ${card('#/players', '📖', 'Player index', 'Search every player in the game', null)}
        ${card('#/about', 'ℹ️', 'About the data', `Updated ${GM.dataDate}`, null)}
      </section>
      <footer class="muted center">Name on leaderboard: <a href="#" id="rename">${GM.esc(GM.getName() || 'not set')}</a></footer>`;
    GM.$$('[data-hard]').forEach(b => b.onclick = () => { GM.setHard(b.dataset.hard === '1'); home(); });
    const ib = GM.$('#install');
    if (installEvt) ib.hidden = false;
    ib.onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; ib.hidden = true; } };
    GM.$('#rename').onclick = async e => {
      e.preventDefault();
      const n = await GM.prompt('Your leaderboard name', GM.getName(), 'e.g. Joel');
      if (n != null && n.trim()) { GM.store.set('name', n.trim().slice(0, 20)); home(); }
    };
  }

  /* ---------------------------------------------------------------- leaderboard */
  async function leaderboard(m) {
    const hard = m ? /^[a-z]+h$/.test(m) && GM.MODES[m] != null : GM.isHard();
    const tabs = ['ultimate', 'ultimateast', 'ultimateapps', 'daily:' + GM.today(), 'target', 'targetast', 'targetapps', 'hopper', 'hilo', 'whoami', 'grid:' + GM.today(), 'grid', 'tally']
      .map(k => hard && GM.HARD_MODES.includes(k) ? k + 'h' : k);
    m = m && tabs.includes(m) ? m : tabs[0];
    const flip = hard ? m.replace(/h$/, '') : (GM.HARD_MODES.includes(m) ? m + 'h' : m);
    const label = k => k.startsWith('daily:') ? '📅 Daily Ultimate' : k.startsWith('grid:') ? '#️⃣ Grid today' : `${GM.MODES[k].icon} ${GM.MODES[k].name.replace(' (Hard)', '')}`;
    const local = GM.store.get('hist:' + m, []);
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🏆 Leaderboards</h2><span></span></div>
      <div class="hard-toggle small"><a class="${hard ? '' : 'on'}" href="#/leaderboard?m=${encodeURIComponent(hard ? flip : m)}">🙂 Normal</a><a class="${hard ? 'on' : ''}" href="#/leaderboard?m=${encodeURIComponent(hard ? m : flip)}">🥵 Hard</a></div>
      <div class="tabs">${tabs.map(k => `<a class="tab ${k === m ? 'active' : ''}" href="#/leaderboard?m=${encodeURIComponent(k)}">${label(k)}</a>`).join('')}</div>
      ${GM.lb.enabled ? `<h3 class="section-title">🌍 Global</h3><div id="global" class="lb"><div class="muted">Loading…</div></div>` :
        `<div class="banner">Global leaderboard isn’t switched on yet – use <b>⚔️ Challenge a friend</b> after a 442 game to go head-to-head on the same spins.</div>`}
      <h3 class="section-title">📱 Your best on this device</h3>
      <div class="lb">${local.length ? local.slice(0, 10).map((h, i) => `<div class="lb-row"><span>${i + 1}</span><span>${new Date(h.t).toLocaleDateString()}</span><b>${h.s}</b></div>`).join('') : '<div class="muted">No games yet</div>'}</div>`;
    if (GM.lb.enabled) {
      try {
        const rows = await GM.lb.top(m);
        const me = GM.getName();
        GM.$('#global').innerHTML = rows.length ? rows.map((r, i) =>
          `<div class="lb-row ${r.name === me ? 'me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span>${GM.esc(r.name)}</span><b>${r.score}</b></div>`).join('')
          : '<div class="muted">No scores yet – be the first!</div>';
      } catch (e) { GM.$('#global').innerHTML = '<div class="muted">Couldn’t load the global board.</div>'; }
    }
  }

  /* ---------------------------------------------------------------- player index */
  function playerIndex() {
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>📖 Player index</h2><span></span></div>
      <div class="filters"><input class="input" id="pq" placeholder="Search name…" autocomplete="off">
      <select class="input" id="pc"><option value="">All clubs</option>${GM.clubs.map(c => `<option>${GM.esc(c)}</option>`).join('')}</select>
      <select class="input" id="ps"><option value="goals">Most goals</option><option value="apps">Most apps</option><option value="name">A–Z</option><option value="first">Newest</option></select></div>
      <div id="plist" class="plist"></div>`;
    const draw = () => {
      const q = GM.fold(GM.$('#pq').value), c = GM.$('#pc').value, s = GM.$('#ps').value;
      let list = GM.players.filter(p => (!q || p.key.includes(q)) && (!c || p.clubs.includes(c)));
      list.sort(s === 'name' ? (a, b) => a.name.localeCompare(b.name) : s === 'first' ? (a, b) => b.first - a.first : (a, b) => b[s] - a[s]);
      GM.$('#plist').innerHTML = `<div class="muted">${list.length} players</div>` + list.slice(0, 150).map(p =>
        `<div class="prow">${GM.avatar(p)}<div><b>${GM.esc(p.name)}</b><small>${GM.flag(p.nat)} ${p.poss.join('/')} · ${GM.era(p)}</small><div class="chips">${p.clubs.map(x => GM.clubChip(x)).join('')}</div></div><span class="num">${p.apps}<small>apps</small></span><span class="num">${p.goals}<small>goals</small></span></div>`).join('');
    };
    ['#pq', '#pc', '#ps'].forEach(s => GM.$(s).addEventListener('input', draw));
    draw();
  }

  function about() {
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>ℹ️ About the data</h2><span></span></div>
      <div class="prose">
      <p>Goal Machine includes <b>${GM.players.length.toLocaleString()}</b> players who have made at least <b>50 Premier League appearances</b> since 1992/93, with their PL goals, assists, appearances, clubs, positions and nationality, plus honours for the full-time badges. Data updated <b>${GM.dataDate}</b>.</p>
      <p>Stats are stitched together from public datasets: the official premierleague.com player pages (1992–2020), Fantasy Premier League gameweek data (2016–today) and Understat season stats (2014–2016). Which club a player was at in each season (for chemistry and title badges) comes from Transfermarkt transfer records. Assists after 2020 are FPL assists, which run slightly higher than the official count. A handful of players’ early seasons are estimated from minutes played, so the odd tally might be off by a game or a goal.</p>
      <p>Only Premier League appearances and goals count – no cups, Europe or Championship seasons.</p>
      <p>This is a fan-made game inspired by FourFourTwo’s 442GOALS and is not affiliated with the Premier League or FourFourTwo.</p>
      </div>`;
  }

  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();
