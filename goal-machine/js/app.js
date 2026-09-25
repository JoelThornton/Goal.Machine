/* Goal Machine – router, home screen, leaderboard, player index */
'use strict';

(function () {
  const app = GM.$('#app');
  let installEvt = null;

  const isAndroid = /Android/i.test(navigator.userAgent);
  // Already "installed"? Inside the Android app, running as an installed web app, or the user said so.
  const standalone = () => !!window.AndroidApp || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const installHidden = () => standalone() || GM.store.get('installed', false);
  let hasNativeApp = false;
  // Android Chrome can tell us if the Goal Machine app is installed (manifest related_applications + app asset_statements)
  if (isAndroid && navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(apps => {
      if (apps && apps.length) { hasNativeApp = true; GM.$$('.install-bar').forEach(b => b.remove()); }
    }).catch(() => { });
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvt = e;
    const b = GM.$('#install'); if (b && !isAndroid && !installHidden()) b.hidden = false;
  });
  window.addEventListener('appinstalled', () => { GM.store.set('installed', true); GM.$$('.install-bar').forEach(b => b.remove()); });

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { path: path || '', q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  // bottom tab bar: shown on the menus, hidden mid-game so the pitch gets the whole screen
  const TABS = [['', '⚽', 'Play'], ['leaderboard', '🏆', 'Leaderboards'], ['album', '📒', 'Album'], ['players', '📖', 'Players']];
  const MENU_PAGES = ['', 'leaderboard', 'album', 'players', 'updates', 'settings', 'about', 'h2h'];
  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.innerHTML = TABS.map(([p, i, l]) => `<a href="#/${p}" data-tab="${p}"><span>${i}</span>${l}</a>`).join('');
  document.body.appendChild(tabbar);
  tabbar.addEventListener('click', () => GM.buzz(8));

  function route() {
    const { path, q } = parseHash();
    window.scrollTo(0, 0);
    GM.$$('.modal-wrap').forEach(m => m.remove());
    app.className = 'page-' + (path || 'home');
    const menu = MENU_PAGES.includes(path);
    document.body.classList.toggle('has-tabs', menu);
    tabbar.hidden = !menu;
    GM.$$('[data-tab]', tabbar).forEach(a => a.classList.toggle('on', a.dataset.tab === path));
    switch (path) {
      case 'draft': return GM.draft.start(app, ['target', 'treble', 'mystery'].includes(q.m) ? q.m : 'ultimate',
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
      case 'album': return GM.album(app, GM.STATS[q.s] ? q.s : 'goals');
      case 'about': return about();
      case 'h2h': return GM.h2h(app);
      case 'h2hplay': return GM.h2hPlay(app);
      case 'updates': return GM.updatesPage(app);
      case 'settings': return settings();
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
    const tile = (href, cls, icon, title, sub, best, extra = '') =>
      `<a class="tile ${cls}" href="${href}"><span class="tile-icon">${icon}</span>${best ? `<span class="tile-pb">PB ${best.toLocaleString()}</span>` : ''}<b>${title}</b><small>${sub}</small>${extra}</a>`;
    const album = GM.albumSummary();
    const h2h = GM.store.get('h2h', null);
    app.innerHTML = `
      <div class="appbar"><a class="icon-btn" href="#/settings" aria-label="Settings">⚙️</a>
        <div class="logo small">GOAL<span>MACHINE</span></div>
        <a class="icon-btn" href="#/updates" aria-label="Updates">📰${GM.hasUnseenUpdate() ? '<i class="new-dot"></i>' : ''}</a></div>
      <header class="hero">
        <p>${GM.players.length.toLocaleString()} Premier League players · 1992 to today</p>
        ${installHidden() || hasNativeApp ? '' : `<div class="install-bar">
          ${isAndroid ? `<a class="btn small" id="getapk" href="${GM.APK_URL}">🤖 Get the Android app</a>` : `<button class="btn small" id="install" hidden>📲 Install app</button>`}
          <button class="install-x" id="install-x" title="I already have it" aria-label="Hide">✕</button></div>`}
        ${GM.appOutdated() ? `<div class="install-bar"><a class="btn small" href="${GM.APK_URL}">📲 New version of the app – tap to update</a></div>` : ''}
      </header>
      <div class="hard-toggle" role="group" aria-label="Difficulty">
        <button class="${hard ? '' : 'on'}" data-hard="0">🙂 Normal<small>clubs, years &amp; apps shown</small></button>
        <button class="${hard ? 'on' : ''}" data-hard="1">🥵 Hard<small>names &amp; positions only, fewer stars</small></button>
      </div>
      <div class="mode-card featured ultimate big-card">
        <span class="mode-icon">👑</span>
        <span class="mode-text"><span class="kicker">Main event</span><b>Ultimate Wildcard</b><small>Build the XI with the biggest total. Every player is equally likely, so find the stars among the journeymen.</small>
          <span class="stat-pick">${statBtn('ultimate', 'goals')}${statBtn('ultimate', 'assists')}${statBtn('ultimate', 'apps')}</span></span>
      </div>
      <a class="h2h-banner" href="#/h2h"><span>⚔️</span><span><b>Head to Head</b><small>${h2h ? `${GM.esc(h2h.names[0])} v ${GM.esc(h2h.names[1])}: tap to carry on` : 'Pass the phone · best of 5 random games'}</small></span><span>🏆</span></a>
      <h3 class="section-title">Today</h3>
      <div class="tiles">
        ${tile('#/daily', 't-green' + (dailyDone ? ' done' : ''), '📅', 'Daily Ultimate', dailyDone ? `Done: ${dailyDone.final ? dailyDone.final.t + ' goals' : ''} · back tomorrow` : 'Same spins for everyone. One shot.')}
        ${tile('#/dailygrid', 't-blue' + (gridDone ? ' done' : ''), '#️⃣', 'Daily Club Grid', gridDone ? 'Done today ✓' : 'Played for both? 3×3 grid', GM.best('grid'))}
      </div>
      <h3 class="section-title">Hit the target</h3>
      <div class="tile t-red wide target-tile"><span class="tile-icon">🎯</span><b>Target</b><small>Hit the number exactly for a bullseye.</small>
        <span class="stat-pick">${statBtn('target', 'goals', '500 goals')}${statBtn('target', 'assists', '350 assists')}${statBtn('target', 'apps', '3,750 apps')}</span></div>
      <div class="tiles">
        ${tile('#/draft?m=treble', 't-gold', '🏆', 'The Treble', '400 goals, 300 assists AND 3,300 apps', pb('treble'))}
        ${tile('#/draft?m=mystery', 't-magenta', '🎲', 'Mystery Target', 'Secret number. Follow the thermometer.', pb('mystery'))}
      </div>
      <h3 class="section-title">Quick games</h3>
      <div class="tiles">
        ${tile('#/hopper', 't-teal', '🦘', 'Club Hopper', 'Club to club through players. 90s.', pb('hopper'))}
        ${tile('#/hilo', 't-orange', '↕️', 'Higher or Lower', 'More goals? More apps?', pb('hilo'))}
        ${tile('#/whoami', 't-indigo', '🕵️', 'Who Am I?', 'Guess the player from the clues', pb('whoami'))}
        ${tile('#/tally', 't-amber', '🔢', 'Guess the Tally', 'How many PL goals?', pb('tally'))}
        ${tile('#/grid', 't-navy wide', '🔀', 'Random Club Grid', 'Endless grids. Obscure answers score more.', pb('grid'))}
      </div>
      <h3 class="section-title">Your collection</h3>
      <a class="tile t-purple wide album-tile" href="#/album"><span class="tile-icon">📒</span><b>Album & badges</b>
        <small>${album.players.toLocaleString()}/${GM.players.length.toLocaleString()} players · ${album.badges}/${album.totalBadges} badges</small>
        <span class="bar"><i style="width:${(100 * album.players / GM.players.length).toFixed(1)}%"></i></span></a>
      <footer class="muted center">Playing as <a href="#" id="rename">${GM.esc(GM.getName() || 'no name yet')}</a> · <a href="#/updates">v${GM.VERSION}</a></footer>`;
    GM.$$('[data-hard]').forEach(b => b.onclick = () => { GM.setHard(b.dataset.hard === '1'); home(); });
    const ib = GM.$('#install');
    if (ib) {
      if (installEvt) ib.hidden = false;
      ib.onclick = async () => {
        if (!installEvt) return;
        installEvt.prompt();
        const { outcome } = await installEvt.userChoice;
        installEvt = null;
        if (outcome === 'accepted') { GM.store.set('installed', true); GM.$$('.install-bar').forEach(b => b.remove()); }
      };
    }
    // downloading the APK counts as installing – don't nag again on this browser
    const ga = GM.$('#getapk'); if (ga) ga.addEventListener('click', () => GM.store.set('installed', true));
    const ix = GM.$('#install-x'); if (ix) ix.onclick = () => { GM.store.set('installed', true); GM.$$('.install-bar').forEach(b => b.remove()); };
    // hide the bar entirely on desktop until Chrome actually offers an install
    const bar = GM.$('.install-bar'); if (bar && ib && !installEvt) bar.hidden = true;
    window.addEventListener('beforeinstallprompt', () => { const b2 = GM.$('.install-bar'); if (b2 && !installHidden()) b2.hidden = false; }, { once: true });
    GM.$('#rename').onclick = async e => {
      e.preventDefault();
      const n = await GM.prompt('Your leaderboard name', GM.getName(), 'e.g. Joel');
      if (n != null && n.trim()) { GM.store.set('name', n.trim().slice(0, 20)); home(); }
    };
  }

  /* ---------------------------------------------------------------- settings */
  function settings() {
    const seg = (id, opts, on) => `<div class="seg" id="${id}">${Object.entries(opts).map(([k, l]) => `<button data-v="${k}" class="${k === String(on) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const build = GM.appBuild(), snd = GM.sound.settings();
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>⚙️ Settings</h2><span></span></div>
      <section class="settings">
        <div class="setting"><b>Appearance</b><small>Auto follows your phone's light or dark setting</small>${seg('s-theme', GM.THEMES, GM.getTheme())}</div>
        <div class="setting"><b>Sound effects</b><small>Whistles, reels, the crowd and the goal horn</small>${seg('s-sfx', { true: '🔊 On', false: '🔇 Off' }, snd.sfx)}
          <label class="vol">🔈<input type="range" id="s-sfxvol" min="0" max="1" step="0.05" value="${snd.sfxVol}">🔊</label></div>
        <div class="setting"><b>Background</b><small>A stadium crowd or a music track while you play</small>${seg('s-bg', { off: '🔇 Off', crowd: '🏟️ Crowd', music: '🎵 Music' }, snd.bg)}
          <label class="vol">🔈<input type="range" id="s-bgvol" min="0" max="1" step="0.05" value="${snd.bgVol}">🔊</label></div>
        <div class="setting"><b>Difficulty</b><small>Hard shows names and positions only, with fewer stars on the reels</small>${seg('s-hard', { false: '🙂 Normal', true: '🥵 Hard' }, GM.isHard())}</div>
        <div class="setting"><b>Vibration</b><small>A little buzz on taps, hops and wins (phones only)</small>${seg('s-buzz', { true: '📳 On', false: '🔕 Off' }, GM.store.get('buzz', true))}</div>
        <div class="setting"><b>Leaderboard name</b><small>${GM.esc(GM.getName() || 'Not set yet')}</small><button class="btn ghost small" id="s-name">✏️ Change name</button></div>
      </section>
      <section class="settings links">
        <a href="#/updates">📰 Updates & version history ${GM.hasUnseenUpdate() ? '<i class="new-dot inline"></i>' : ''}<span>›</span></a>
        <a href="#/about">ℹ️ About the data<span>›</span></a>
        ${build == null ? `<a href="${GM.APK_URL}">🤖 Android app (APK)<span>›</span></a>` : ''}
      </section>
      <p class="muted center">Goal Machine v${GM.VERSION}${build != null ? ` · App build ${build}` : ''}<br>Made by Opportunistic Games</p>`;
    const wire = (id, fn) => GM.$$('#' + id + ' [data-v]').forEach(b => b.onclick = () => {
      fn(b.dataset.v); GM.buzz(); GM.$$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
    });
    wire('s-theme', v => GM.setTheme(v));
    wire('s-hard', v => GM.setHard(v === 'true'));
    wire('s-buzz', v => GM.store.set('buzz', v === 'true'));
    wire('s-sfx', v => { GM.sound.set('sfx', v === 'true'); GM.sound.play('whistle'); });
    wire('s-bg', v => GM.sound.set('bg', v));
    GM.$('#s-sfxvol').onchange = e => { GM.sound.set('sfxVol', +e.target.value); GM.sound.play('good'); };
    GM.$('#s-bgvol').oninput = e => GM.sound.set('bgVol', +e.target.value);
    GM.$('#s-name').onclick = async () => {
      const n = await GM.prompt('Your leaderboard name', GM.getName(), 'e.g. Joel');
      if (n != null && n.trim()) { GM.store.set('name', n.trim().slice(0, 20)); settings(); }
    };
  }

  /* ---------------------------------------------------------------- leaderboard */
  async function leaderboard(m) {
    const hard = m ? /^[a-z]+h$/.test(m) && GM.MODES[m] != null : GM.isHard();
    const tabs = ['ultimate', 'ultimateast', 'ultimateapps', 'daily:' + GM.today(), 'target', 'targetast', 'targetapps', 'treble', 'mystery', 'hopper', 'hilo', 'whoami', 'grid:' + GM.today(), 'grid', 'tally']
      .map(k => hard && GM.HARD_MODES.includes(k) ? k + 'h' : k);
    m = m && tabs.includes(m) ? m : tabs[0];
    const flip = hard ? m.replace(/h$/, '') : (GM.HARD_MODES.includes(m) ? m + 'h' : m);
    const label = k => k.startsWith('daily:') ? '📅 Daily Ultimate' : k.startsWith('grid:') ? '#️⃣ Grid today' : `${GM.MODES[k].icon} ${GM.MODES[k].name.replace(' (Hard)', '')}`;
    const local = GM.store.get('hist:' + m, []);
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🏆 Leaderboards</h2><span></span></div>
      <div class="hard-toggle small"><a class="${hard ? '' : 'on'}" href="#/leaderboard?m=${encodeURIComponent(hard ? flip : m)}">🙂 Normal</a><a class="${hard ? 'on' : ''}" href="#/leaderboard?m=${encodeURIComponent(hard ? m : flip)}">🥵 Hard</a></div>
      <div class="tabs">${tabs.map(k => `<a class="tab ${k === m ? 'active' : ''}" href="#/leaderboard?m=${encodeURIComponent(k)}">${label(k)}</a>`).join('')}</div>
      ${GM.lb.enabled ? `<h3 class="section-title">🌍 Global</h3><div id="global" class="lb"><div class="muted">Loading…</div></div>` :
        `<div class="banner">Global leaderboard isn’t switched on yet – use <b>⚔️ Challenge a friend</b> after a game to go head-to-head on the same spins.</div>`}
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
      <p>Goal Machine includes <b>${GM.players.length.toLocaleString()}</b> players who have made at least <b>50 Premier League appearances</b> since 1992/93, with their PL goals, assists, appearances, clubs, positions and nationality, plus honours for the full-time badges. Stats include matches up to <b>${GM.dataDate}</b> and refresh automatically every week.</p>
      <p>Stats are stitched together from public datasets: the official premierleague.com player pages (1992–2020), Fantasy Premier League gameweek data (2016–today) and Understat season stats (2014–2016). Which club a player was at in each season (for chemistry and title badges) comes from Transfermarkt transfer records. Assists after 2020 are FPL assists, which run slightly higher than the official count. A handful of players’ early seasons are estimated from minutes played, so the odd tally might be off by a game or a goal.</p>
      <p>Only Premier League appearances and goals count – no cups, Europe or Championship seasons.</p>
      <p>📲 Android app: <a href="${GM.APK_URL}">download the latest APK</a>. Game updates arrive automatically in the app.</p>
      <p>This is a fan-made game inspired by FourFourTwo’s 442GOALS and is not affiliated with the Premier League or FourFourTwo.</p>
      </div>`;
  }

  window.addEventListener('hashchange', route);
  route();
  // loading screen off, then (once per release) what's new
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('gone'); setTimeout(() => splash.remove(), 500); }
  if (!parseHash().path) setTimeout(GM.maybeShowWhatsNew, 600);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // when a new version's service worker takes over, reload once so the new files are used straight away
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  }
})();
