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
  const TABS = [['', '⚽', 'Play'], ['today', '<i class="cal-slot"></i>', 'Today'], ['leaderboard', '🏆', 'Ranks'], ['album', '📒', 'Album'], ['players', '📖', 'Players']];
  const MENU_PAGES = ['', 'today', 'leaderboard', 'album', 'players', 'updates', 'settings', 'about', 'h2h', 'credits'];
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
    GM.sound.scene(path);  // each game area has its own music
    GM.$('.cal-slot', tabbar).innerHTML = GM.calIcon();  // stays right past midnight
    switch (path) {
      case 'draft': return GM.draft.start(app, ['target', 'treble', 'mystery', 'club', 'classic', 'classicwild', 'ultimatepure', 'extreme', 'purist'].includes(q.m) ? q.m : 'ultimate',
        { stat: q.s, seed: q.seed, vs: q.vs, vss: q.vss ? +q.vss : undefined, hard: q.seed ? q.h === '1' : GM.isHard(), club: q.c });
      case 'today': return GM.todayPage(app);
      case 'online': return GM.onlinePage(app, q);
      case 'footle': return GM.footle(app, false);
      case 'clubfootle': return GM.footle(app, true);
      case 'daily': return GM.draft.start(app, 'daily');
      case 'hilo': return GM.hilo(app);
      case 'hopper': return GM.hopper(app);
      case 'whoami': return GM.whoami(app);
      case 'grid': return GM.grid(app, false);
      case 'dailygrid': return GM.grid(app, true);
      case 'tally': return GM.tally(app);
      case 'leaderboard': return leaderboard(q.m);
      case 'players': return playerIndex();
      case 'album': return GM.album(app, GM.STATS[q.s] ? q.s : 'goals', q.b === 'purist' ? 'purist' : 'album');
      case 'about': return about();
      case 'credits': return credits();
      case 'h2h': return GM.h2h(app);
      case 'h2hplay': return GM.h2hPlay(app);
      case 'updates': return GM.updatesPage(app);
      case 'settings': return settings();
      default: return home();
    }
  }

  /* ---------------------------------------------------------------- home */
  function home() {
    const hard = GM.isHard();
    const pb = k => GM.best(hard && GM.HARD_MODES.includes(k) ? k + 'h' : k);
    const club = GM.favClub(), waiting = GM.account() ? GM.store.get('onlineWaiting', 0) : 0;
    const statBtn = (m, s, label) => {
      const st = GM.STATS[s], best = m === 'club' ? GM.best(GM.draft.modeKey(m, s, false, club)) : pb(GM.draft.modeKey(m, s, false));
      return `<a class="stat-btn" href="#/draft?m=${m}&s=${s}${m === 'club' ? '&c=' + encodeURIComponent(club) : ''}"><i class="sb-ico">${st.icon}</i>${label || st.name}${best ? `<small>PB ${best.toLocaleString()}</small>` : ''}</a>`;
    };
    const tile = (href, cls, icon, title, sub, best, extra = '') =>
      `<a class="tile ${cls}" href="${href}"><span class="tile-icon">${icon}</span>${best ? `<span class="tile-pb">PB ${best.toLocaleString()}</span>` : ''}<b>${title}</b><small>${sub}</small>${extra}</a>`;
    const album = GM.albumSummary();
    // The main event: pick the player pool and whether wildcards are on - six modes in two small switches (remembered)
    const POOLS = {
      classic: { icon: '⭐', short: 'Classic', on: 'classicwild', off: 'classic', about: 'Every player with 50+ PL apps, and the better known they are, the more often they turn up' },
      ultimate: { icon: '👑', short: 'Ultimate', on: 'ultimate', off: 'ultimatepure', about: 'Every player with 50+ PL apps, all equally likely, so find the stars among the journeymen' },
      extreme: { icon: '⚡', short: 'Extreme', on: 'extreme', off: 'purist', about: 'Every one of the 5,000+ players ever to play in the PL, all equally likely. Mostly strangers' },
    };
    const pool = POOLS[GM.store.get('ultPool', 'ultimate')] ? GM.store.get('ultPool', 'ultimate') : 'ultimate';
    const wild = GM.store.get('ultWild', true) !== false;
    const ult = POOLS[pool][wild ? 'on' : 'off'];
    const ultName = GM.MODES[ult].name;
    const ultSub = `${POOLS[pool].about}. ${wild ? 'Wildcards on.' : 'No wildcards: just the reels and your knowledge.'}${ult === 'purist' ? ' Fills your 💎 Purist collection.' : ''}`;
    const streak = GM.streak();
    const dtile = (g, cls, sub) => {
      const G = GM.DAILY_GAMES[g], st = GM.dailyStatus(g), gs = GM.streak(g);
      return `<a class="tile ${cls}${st.done ? ' done' : ''}" href="${G.href}"><span class="tile-icon">${G.icon}</span>${gs ? `<span class="tile-pb">🔥 ${gs}</span>` : ''}
        <b>${g === 'club' ? GM.esc(GM.clubShort(club)) + ' Footle' : G.name}</b><small>${st.text || sub}</small></a>`;
    };
    const h2h = GM.store.get('h2h', null);
    app.innerHTML = `
      <div class="appbar"><a class="icon-btn" href="#/settings" aria-label="Settings">⚙️</a>
        <div class="logo small">GOAL<span>MACHINE</span></div>
        <a class="icon-btn" href="#/updates" aria-label="Updates">📰${GM.hasUnseenUpdate() ? '<i class="new-dot"></i>' : ''}</a></div>
      <header class="hero">
        <p>${club ? `<span class="fan-chip">${GM.clubChip(club, true)}</span> ` : ''}${GM.allPlayers ? GM.allPlayers.length.toLocaleString() : "5,000+"} Premier League players · 1992 to today</p>
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
        <span class="mode-icon">${GM.MODES[ult].icon}</span>
        <span class="mode-text"><span class="kicker">Main event</span><b>${ultName}</b><small>${ultSub}</small>
          <span class="variant" role="group" aria-label="Players">${Object.entries(POOLS).map(([k, v]) => `<button data-pool="${k}" class="${k === pool ? 'on' : ''}"><span>${v.icon}</span>${v.short}</button>`).join('')}</span>
          <span class="variant wild-switch" role="group" aria-label="Wildcards"><button data-wild="1" class="${wild ? 'on' : ''}">🃏 Wildcards on</button><button data-wild="0" class="${wild ? '' : 'on'}">🚫 No wildcards</button></span>
          <span class="stat-pick">${statBtn(ult, 'goals')}${statBtn(ult, 'assists')}${statBtn(ult, 'apps')}</span></span>
      </div>
      <a class="h2h-banner" href="${waiting ? '#/online' : '#/h2h'}"><span>⚔️</span><span><b>Head to Head</b><small>${waiting ? `🌐 ${waiting} online game${waiting > 1 ? 's' : ''} waiting for your move` : h2h ? `${GM.esc(h2h.names[0])} v ${GM.esc(h2h.names[1])}: tap to carry on` : 'Pass the phone, or play your mates online'}</small></span><span>🏆</span><i class="online-badge" ${waiting ? '' : 'hidden'}>${waiting}</i></a>
      <h3 class="section-title"><a href="#/today">Today${streak ? ` <span class="streak-pill">🔥 ${streak}</span>` : ''}<span class="more">All dailies ›</span></a></h3>
      <div class="tiles">
        ${dtile('daily', 't-green', 'Same spins for everyone. One shot.')}
        ${dtile('footle', 't-teal', 'Guess the player in 8')}
        ${dtile('grid', 't-blue', 'Played for both? 3×3 grid')}
        ${club ? dtile('club', 'club-tile', 'Mystery player from your club') : `<a class="tile t-navy" href="#/settings"><span class="tile-icon">🏟️</span><b>Pick your club</b><small>Unlock Club Footle, Club XI and your colours</small></a>`}
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
      ${club ? `<h3 class="section-title">Your club</h3>
      <div class="tile club-tile wide target-tile"><span class="tile-icon">🏟️</span><b>${GM.esc(club)} XI</b><small>Ultimate Wildcard with only ${GM.esc(club)} players. Their whole PL careers count.</small>
        <span class="stat-pick">${statBtn('club', 'goals')}${statBtn('club', 'assists')}${statBtn('club', 'apps')}</span></div>` : ''}
      <h3 class="section-title">Your collection</h3>
      <a class="tile t-purple wide album-tile" href="#/album"><span class="tile-icon">📒</span><b>Album & badges</b>
        <small>${album.players.toLocaleString()}/${GM.players.length.toLocaleString()} players · ${album.badges}/${album.totalBadges} badges${album.purist ? ` · 💎 ${album.purist.toLocaleString()} purist` : ''}</small>
        <span class="bar"><i style="width:${(100 * album.players / GM.players.length).toFixed(1)}%"></i></span></a>
      <button class="btn ghost share-game" id="share-game">📣 Share Goal Machine with your mates</button>
      <footer class="muted center">Playing as <a href="#/settings">${GM.account() ? '🔒 ' : ''}${GM.esc(GM.getName() || 'no name yet')}</a> · <a href="#/updates">v${GM.VERSION}</a></footer>`;
    GM.$$('[data-hard]').forEach(b => b.onclick = () => { GM.setHard(b.dataset.hard === '1'); home(); });
    GM.$('#share-game').onclick = () => GM.shareGame();
    if (GM.online && GM.online.check) GM.online.check().then(() => {  // refresh the banner if the count changed
      const n = GM.store.get('onlineWaiting', 0), sm = GM.$('.h2h-banner small');
      if (sm && n !== waiting && location.hash.replace(/^#\/?/, '') === '') home();
    });
    GM.$$('[data-pool]').forEach(b => b.onclick = () => { GM.store.set('ultPool', b.dataset.pool); home(); });
    GM.$$('[data-wild]').forEach(b => b.onclick = () => { GM.store.set('ultWild', b.dataset.wild === '1'); home(); });
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
  }

  /* ---------------------------------------------------------------- settings */
  function settings() {
    const seg = (id, opts, on) => `<div class="seg" id="${id}">${Object.entries(opts).map(([k, l]) => `<button data-v="${k}" class="${k === String(on) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const build = GM.appBuild(), snd = GM.sound.settings();
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>⚙️ Settings</h2><span></span></div>
      <section class="settings">
        <div class="setting"><b>Account</b>${GM.account()
          ? `<small>Your leaderboard name is <b>🔒 ${GM.esc(GM.account().name)}</b>. It's yours alone: only this device can post scores with it.</small>
            <div class="setting-btns"><button class="btn ghost small" id="s-move">📲 Move to another phone</button><button class="btn ghost small" id="s-name">✏️ New name</button></div>`
          : `<small>${GM.getName() ? `You play as “${GM.esc(GM.getName())}”, but it isn't claimed yet.` : 'No leaderboard name yet.'} Claim a unique name so nobody else can post scores as you.</small>
            <div class="setting-btns"><button class="btn small" id="s-name">🔒 Claim a name</button><button class="btn ghost small" id="s-code">🔑 I have a transfer code</button></div>`}</div>
        <div class="setting"><b>Appearance</b><small>Auto follows your phone's light or dark setting. Club paints the game in your favourite club's colours</small>${seg('s-theme', GM.THEMES, GM.getTheme())}</div>
        <div class="setting"><b>Favourite club</b><small>Unlocks Club Footle and Club XI, and brings your club's colours to the app</small>
          <select class="input" id="s-club"><option value="">None</option>${GM.clubOptions().map(c => `<option ${c === GM.favClub() ? 'selected' : ''}>${GM.esc(c)}</option>`).join('')}</select></div>
        <div class="setting"><b>Sound effects</b><small>Whistles, reels, the crowd and the goal horn</small>${seg('s-sfx', { true: '🔊 On', false: '🔇 Off' }, snd.sfx)}
          <label class="vol">🔈<input type="range" id="s-sfxvol" min="0" max="1" step="0.05" value="${snd.sfxVol}">🔊</label></div>
        <div class="setting"><b>Music</b><small id="s-bg-about"></small>${seg('s-bg', { off: '🔇 Off', music: '🎹 Game', tunes: '🎧 Soundtrack' }, snd.bg)}
          <label class="vol">🔈<input type="range" id="s-bgvol" min="0" max="1" step="0.05" value="${snd.bgVol}">🔊</label>
          <div class="now-playing" id="s-now" hidden><span></span><button class="btn ghost small" id="s-skip">⏭ Next song</button></div></div>
        ${GM.app('notificationsAllowed') !== undefined ? `<div class="setting"><b>Notifications</b><small>A whistle when a friend challenges you, it's your move, or a game finishes</small>
          <div class="setting-btns"><span class="muted">${GM.app('notificationsAllowed') ? '🔔 On' : '🔕 Off'}</span><button class="btn ghost small" id="s-notif">Change in phone settings</button></div></div>` : ''}
        <div class="setting"><b>Difficulty</b><small>Hard shows names and positions only, with fewer stars on the reels</small>${seg('s-hard', { false: '🙂 Normal', true: '🥵 Hard' }, GM.isHard())}</div>
        <div class="setting"><b>Vibration</b><small>A little buzz on taps, hops and wins (phones only)</small>${seg('s-buzz', { true: '📳 On', false: '🔕 Off' }, GM.store.get('buzz', true))}</div>
      </section>
      <section class="settings links">
        <a href="#" id="s-share">📣 Share Goal Machine with a friend<span>›</span></a>
        <a href="#/updates">📰 Updates & version history ${GM.hasUnseenUpdate() ? '<i class="new-dot inline"></i>' : ''}<span>›</span></a>
        <a href="#/about">ℹ️ About the data<span>›</span></a>
        ${build == null ? `<a href="${GM.APK_URL}">🤖 Android app (APK)<span>›</span></a>` : ''}
        <a href="privacy.html">🔐 Privacy policy<span>›</span></a>
      </section>
      <p class="muted center">Goal Machine v${GM.VERSION}${build != null ? ` · App build ${build}` : ''}<br>Made by Opportunistic Games</p>`;
    const wire = (id, fn) => GM.$$('#' + id + ' [data-v]').forEach(b => b.onclick = () => {
      fn(b.dataset.v); GM.buzz(); GM.$$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
    });
    const nb = GM.$('#s-notif'); if (nb) nb.onclick = () => GM.app('openNotificationSettings');
    GM.$('#s-share').onclick = e => { e.preventDefault(); GM.shareGame(); };
    wire('s-theme', v => { GM.setTheme(v); if (v === 'club' && !GM.favClub()) GM.toast('🏟️ Pick your favourite club below to see its colours'); });
    wire('s-hard', v => GM.setHard(v === 'true'));
    wire('s-buzz', v => GM.store.set('buzz', v === 'true'));
    GM.$('#s-club').onchange = e => { GM.setFavClub(e.target.value); GM.sound.play('whistle'); if (e.target.value) GM.toast(`🏟️ Welcome, ${GM.esc(GM.clubShort(e.target.value))} fan!`); };
    wire('s-sfx', v => { GM.sound.set('sfx', v === 'true'); GM.sound.play('whistle'); });
    const bgInfo = () => {
      const v = GM.sound.settings().bg, t = GM.sound.nowPlaying();
      GM.$('#s-bg-about').textContent = v === 'tunes' ? 'Real songs on shuffle, the same wherever you are in the game'
        : 'Made for the game: Anthem on the menus, Matchday for team builders, Thinking Cap for puzzles and Derby for head-to-heads';
      GM.$('#s-now').hidden = v !== 'tunes';
      GM.$('#s-now span').innerHTML = t ? `🎧 <b>${GM.esc(t.title)}</b>${t.artist ? `<small>${GM.esc(t.artist)}</small>` : ''}` : '🎧 Tap anywhere to start';
    };
    bgInfo();
    document.addEventListener('gm-tune', () => { if (GM.$('#s-now')) bgInfo(); });
    wire('s-bg', v => { GM.sound.set('bg', v); bgInfo(); });
    GM.$('#s-skip').onclick = () => GM.sound.skipTune();
    GM.$('#s-sfxvol').onchange = e => { GM.sound.set('sfxVol', +e.target.value); GM.sound.play('good'); };
    GM.$('#s-bgvol').oninput = e => GM.sound.set('bgVol', +e.target.value);
    GM.$('#s-name').onclick = async () => {
      if (GM.account()) {  // a new name gets its own entry; scores already posted stay under the old one
        GM.store.set('account', { ...GM.account(), name: '' });
        const n = await GM.accountModal('Pick a new name. Scores you have already posted stay under your old one.');
        if (!n) GM.store.set('account', { ...GM.account(), name: GM.store.get('name', '') });
      } else await GM.askName();
      settings();
    };
    const mv = GM.$('#s-move');
    if (mv) mv.onclick = () => {
      const code = GM.transferCode();
      const m = GM.modal(`<h3>📲 Move to another phone</h3><p>On the new phone, open ⚙️ Settings → Account → <b>I have a transfer code</b> and paste this code:</p>
        <div class="code-box">${code}</div><p class="muted">Keep it private: anyone with this code can post scores as you.</p>
        <div class="row"><button class="btn ghost" data-close>Done</button><button class="btn" id="copycode">📋 Copy</button></div>`);
      GM.$('#copycode', m.el).onclick = async () => { try { await navigator.clipboard.writeText(code); GM.toast('Copied'); } catch (e) { GM.toast('Press and hold the code to copy it'); } };
    };
    const cd = GM.$('#s-code');
    if (cd) cd.onclick = async () => {
      const code = await GM.prompt('Paste your transfer code', '', 'from Settings on your old phone', 200);
      if (!code) return;
      const r = await GM.useTransferCode(code);
      GM.toast(r === 'ok' ? `🔒 Welcome back, ${GM.esc(GM.getName())}` : r === 'offline' ? 'Couldn’t reach the leaderboard – try again' : 'That code doesn’t match any account');
      settings();
    };
  }

  /* ---------------------------------------------------------------- leaderboard */
  async function leaderboard(m) {
    if (m && m.startsWith('dailies')) return dailyBoard(m.split(':')[1]);
    const hard = m ? /^[a-z]+h$/.test(m) && GM.MODES[m] != null : GM.isHard();
    const club = GM.favClub();
    const tabs = ['ultimate', 'ultimateast', 'ultimateapps', 'ultimatepure', 'classicwild', 'classic', 'extreme', 'purist', 'daily:' + GM.today(), 'footle:' + GM.today(), 'target', 'targetast', 'targetapps', 'treble', 'mystery', 'hopper', 'hilo', 'whoami', 'grid:' + GM.today(), 'grid', 'tally']
      .concat(club ? ['club' + GM.slug(club)] : [])
      .map(k => hard && GM.HARD_MODES.includes(k) ? k + 'h' : k);
    m = m && tabs.includes(m) ? m : tabs[0];
    const flip = hard ? m.replace(/h$/, '') : (GM.HARD_MODES.includes(m) ? m + 'h' : m);
    const label = k => k.startsWith('daily:') ? GM.calIcon() + ' Daily Ultimate' : k.startsWith('grid:') ? '#️⃣ Grid today' : k.startsWith('footle:') ? '🟩 Footle today' : `${GM.MODES[k].icon} ${GM.MODES[k].name.replace(' (Hard)', '')}`;
    const local = GM.store.get('hist:' + m, []);
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🏆 Leaderboards</h2><span></span></div>
      <div class="hard-toggle small"><a class="${hard ? '' : 'on'}" href="#/leaderboard?m=${encodeURIComponent(hard ? flip : m)}">🙂 Normal</a><a class="${hard ? 'on' : ''}" href="#/leaderboard?m=${encodeURIComponent(hard ? m : flip)}">🥵 Hard</a></div>
      <div class="tabs"><a class="tab" href="#/leaderboard?m=dailies">📊 Daily stars</a>${tabs.map(k => `<a class="tab ${k === m ? 'active' : ''}" href="#/leaderboard?m=${encodeURIComponent(k)}">${label(k)}</a>`).join('')}</div>
      ${m.startsWith('footle:') ? '<p class="muted center">Footle scores: 8 for a first-guess win, down to 1 for getting it on the last guess.</p>' : ''}
      ${GM.lb.enabled ? `<h3 class="section-title">🌍 Global</h3><div id="global" class="lb"><div class="muted">Loading…</div></div>` :
        `<div class="banner">Global leaderboard isn’t switched on yet – use <b>⚔️ Challenge a friend</b> after a game to go head-to-head on the same spins.</div>`}
      ${/^(ultimate|club|classic|extreme|purist)/.test(m) || m.startsWith('daily:') ? `<h3 class="section-title">📊 Your spread</h3>${m.startsWith('daily:') ? GM.distHtml('daily', 'goals')
        : GM.distHtml(m, /apps(h)?$/.test(m) ? 'apps' : /ast(h)?$/.test(m) ? 'assists' : 'goals')}` : ''}
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

  // Daily stars: who turns up and does well every day (from the daily_board view)
  async function dailyBoard(sort) {
    const SORTS = { big_days: ['⚽ 450+ days', 'Daily Ultimates with 450+ goals'], footle_wins: ['🟩 Footle wins', 'Footles solved'],
      grid_days: ['#️⃣ Grids', 'Daily Club Grids completed'], best_streak: ['🔥 Streaks', 'Longest run of days playing a daily'] };
    sort = SORTS[sort] ? sort : 'big_days';
    const me = GM.getName();
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>📊 Daily stars</h2><span></span></div>
      <div class="tabs"><a class="tab active" href="#/leaderboard?m=dailies">📊 Daily stars</a><a class="tab" href="#/leaderboard">🏆 Game boards ›</a></div>
      <div class="seg" id="dsort">${Object.entries(SORTS).map(([k, [l]]) => `<button data-v="${k}" class="${k === sort ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="muted center">${SORTS[sort][1]}. Every player's daily results count, and you don't need a streak.</p>
      <div id="dboard" class="lb">${GM.lb.enabled ? '<div class="muted">Loading…</div>' : '<div class="muted">The global leaderboard is switched off.</div>'}</div>
      <h3 class="section-title">📱 You</h3>
      <div class="dstats">
        <div><b>${Object.values(GM.dailyLog()).filter(e => e.daily >= 450).length}</b><small>450+ days</small></div>
        <div><b>${Object.values(GM.dailyLog()).filter(e => e.footle > 0).length}</b><small>Footle wins</small></div>
        <div><b>${Object.values(GM.dailyLog()).filter(e => e.grid != null).length}</b><small>Grids</small></div>
        <div><b>${GM.bestStreak()}</b><small>Best streak</small></div></div>`;
    GM.$$('#dsort [data-v]').forEach(b => b.onclick = () => { location.hash = '#/leaderboard?m=dailies:' + b.dataset.v; });
    if (!GM.lb.enabled) return;
    try {
      const rows = await GM.lb.dailyBoard(sort);
      GM.$('#dboard').innerHTML = rows.length ? rows.map((r, i) => `<div class="lb-row ${r.name === me ? 'me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
        <span>${GM.esc(r.name)}<small class="muted"> · ${r.days_played} day${r.days_played === 1 ? '' : 's'}${r.current_streak > 1 ? ` · 🔥${r.current_streak}` : ''}</small></span><b>${r[sort]}</b></div>`).join('')
        : '<div class="muted">No daily results yet. Be the first!</div>';
    } catch (e) { GM.$('#dboard').innerHTML = '<div class="muted">Couldn’t load the daily board.</div>'; }
  }

  /* ---------------------------------------------------------------- player index */
  function playerIndex() {
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>📖 Player index</h2><span></span></div>
      <div class="filters"><input class="input" id="pq" placeholder="Search name…" autocomplete="off">
      <select class="input" id="pc"><option value="">All clubs</option>${GM.clubs.map(c => `<option>${GM.esc(c)}</option>`).join('')}</select>
      <select class="input" id="pa"><option value="1">Every PL player</option><option value="50">50+ apps</option><option value="100">100+ apps</option><option value="300">300+ apps</option></select>
      <select class="input" id="ps"><option value="goals">Most goals</option><option value="ast">Most assists</option><option value="apps">Most apps</option><option value="name">A–Z</option><option value="first">Newest</option></select></div>
      <div id="plist" class="plist"></div>`;
    let pool = GM.allPlayers || GM.players;
    const draw = () => {
      if (!GM.$('#plist')) return;
      const q = GM.fold(GM.$('#pq').value), c = GM.$('#pc').value, s = GM.$('#ps').value, min = +GM.$('#pa').value;
      let list = pool.filter(p => p.apps >= min && (!q || p.key.includes(q)) && (!c || p.clubs.includes(c)));
      list.sort(s === 'name' ? (a, b) => a.name.localeCompare(b.name) : s === 'first' ? (a, b) => b.first - a.first : (a, b) => b[s] - a[s] || b.apps - a.apps);
      GM.$('#plist').innerHTML = `<div class="muted">${list.length.toLocaleString()} players${pool === GM.players && min < 50 ? ' · loading everyone else…' : list.length > 150 ? ' · showing the top 150, search to find anyone' : ''}</div>` + list.slice(0, 150).map(p =>
        `<div class="prow">${GM.avatar(p)}<div><b>${GM.esc(p.name)}</b><small>${GM.flag(p.nat)} ${p.poss.join('/')} · ${GM.era(p)}</small><div class="chips">${p.clubs.map(x => GM.clubChip(x)).join('')}</div></div><span class="num">${p.apps}<small>apps</small></span><span class="num">${s === 'ast' ? p.ast : p.goals}<small>${s === 'ast' ? 'assists' : 'goals'}</small></span></div>`).join('');
    };
    ['#pq', '#pc', '#ps', '#pa'].forEach(s => GM.$(s).addEventListener('input', draw));
    draw();
    // everyone who has played in the PL (5,000+) loads in the background; the 50+ list shows straight away
    if (pool === GM.players) GM.loadAll().then(all => {
      pool = all;
      const sel = GM.$('#pc');
      if (sel) [...new Set(all.flatMap(p => p.clubs))].filter(c => !GM.clubs.includes(c)).forEach(c => sel.append(new Option(c)));
      draw();
    }).catch(() => { });
  }

  function about() {
    app.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>ℹ️ About the data</h2><span></span></div>
      <div class="prose">
      <p>Goal Machine includes <b>${GM.players.length.toLocaleString()}</b> players who have made at least <b>50 Premier League appearances</b> since 1992/93, with their PL goals, assists, appearances, clubs, positions and nationality, plus honours for the full-time badges. Stats include matches up to <b>${GM.dataDate}</b> and refresh automatically every week.</p>
      <p>Stats are stitched together from public datasets: the official premierleague.com player pages (1992–2020), Fantasy Premier League gameweek data (2016–today) and Understat season stats (2014–2016). Which club a player was at in each season (for chemistry and title badges) comes from Transfermarkt transfer records. Assists after 2020 are FPL assists, which run slightly higher than the official count. A handful of players’ early seasons are estimated from minutes played, so the odd tally might be off by a game or a goal.</p>
      <p>Only Premier League appearances and goals count – no cups, Europe or Championship seasons.</p>
      <p>📸 Player photos come from the Premier League, Transfermarkt and Wikimedia Commons (<a href="#/credits">photo credits</a>). Players without a photo show their initials in their club colours.</p>
      ${GM.playSafe ? '' : `<p>📲 Android app: <a href="${GM.APK_URL}">download the latest APK</a>. Game updates arrive automatically in the app.</p>`}
      <p>🎧 Soundtrack music from <a href="https://www.epidemicsound.com/">Epidemic Sound</a>: <span id="tune-credits">the songs in the playlist</span>.</p>
      <p>🔐 <a href="privacy.html">Privacy policy</a></p>
      <p>This is a fan-made game inspired by FourFourTwo’s 442GOALS and is not affiliated with the Premier League or FourFourTwo.</p>
      </div>`;
    GM.sound.tuneList().then(list => {
      const el = GM.$('#tune-credits');
      if (el && list && list.length) el.innerHTML = list.map(t => `“${GM.esc(t.title)}”${t.artist ? ' by ' + GM.esc(t.artist) : ''}`).join(', ');
    });
  }

  // Wikimedia Commons photos are freely licensed but need crediting
  function credits() {
    const list = GM.players.filter(p => p.photo && p.photo.w).sort((a, b) => a.name.localeCompare(b.name));
    app.innerHTML = `<div class="topbar"><a href="#/about" class="back">‹</a><h2>📸 Photo credits</h2><span></span></div>
      <p class="muted">These photos come from Wikimedia Commons under the licences shown. Tap one to see the original file and its full licence. Other photos are from premierleague.com and Transfermarkt.</p>
      <div class="plist">${list.length ? list.map(p => `<a class="prow credit" href="${GM.esc(p.photo.u)}" target="_blank" rel="noopener">${GM.avatar(p)}<div><b>${GM.esc(p.name)}</b>
        <small>📷 ${GM.esc(p.photo.a)} · ${GM.esc(p.photo.l)}</small></div></a>`).join('') : '<div class="muted">No Wikimedia photos in use yet.</div>'}</div>`;
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
