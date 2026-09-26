/* Goal Machine – online games with friends, Words-with-Friends style. Games belong to your 🔒 account name, not a phone,
   so you can leave and come back any time (Supabase functions online_create / online_join / online_get / online_move /
   online_resign / online_games / online_friends / online_add_friend / online_waiting).
   - Live Race: both build an Ultimate XI on the same fair spins, whenever suits you. Once you've finished you can watch
     their XI being built. Match points: 50 for the bigger total, 30 for the better squad rating, 20 for the quicker XI.
   - Draft Duel: take turns picking from the same five players each spin (the player challenged gets the first pick,
     then it swaps every spin). Every spin
     has at least two players who fit each of you, so there's always a choice. When you're both in the game there's a
     15-second pick clock. Match points: 60 for the bigger total, 40 for the better squad rating.
   The server works out the match points once both XIs are done, and keeps every finished game for your history and
   head-to-head records. */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SEATS = ['host', 'guest'];
  const PICK_SECONDS = 15;
  const other = s => (s === 'host' ? 'guest' : 'host');
  const esc = GM.esc, fmt = n => Math.round(n).toLocaleString();
  // modes in the weekly friends league
  const LEAGUE = [['ultimate', '👑 Ultimate'], ['chaos', '🌪️ CHAOS'], ['dchaos', '📅 Daily CHAOS'], ['daily', '📅 Daily Ultimate'], ['mbdaily', '💰 Daily Moneyball'], ['moneyball', '💰 Moneyball']];
  const KIND = { duel: { icon: '🤝', name: 'Draft Duel' }, scout: { icon: '🕵️', name: 'Scout Duel' }, race: { icon: '🏁', name: 'Live Race' },
    target: { icon: '🎯', name: 'Target Race' }, chaos: { icon: '🌪️', name: 'CHAOS Race' }, auction: { icon: '🔨', name: 'Auction' } };
  // a Scout Duel is a Draft Duel with hidden names; Target and CHAOS Races are Live Races played in those modes
  const gk = g => (['scout', 'target', 'chaos'].includes(g.variant) ? g.variant : g.kind);
  const serverKind = k => (k === 'scout' ? 'duel' : k === 'target' || k === 'chaos' ? 'race' : k);
  const raceMode = r => (r.variant === 'target' ? 'target' : r.variant === 'chaos' ? 'chaos' : 'ultimate');
  const rpc = (f, a) => GM.lb.rpc(f, a);
  const auth = () => { const a = GM.account(); return a ? { p_user: a.name, p_key: a.key } : null; };
  const me = () => (GM.account() || {}).name || '';
  let poll = null, timer = null;
  const stopPoll = () => { clearInterval(poll); poll = null; clearInterval(timer); timer = null; GM.app('keepAwake', false); };
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/online')) stopPoll(); });
  const top = (t, back = '#/') => `<div class="topbar"><a href="${back}" class="back">‹</a><h2>🌐 ${t}</h2><span></span></div>`;
  const seatOf = g => (g.host === me() ? 'host' : g.guest === me() ? 'guest' : null);
  const oppOf = g => (g.host === me() ? g.guest : g.host);
  const when = t => { const d = new Date(t), days = Math.floor((Date.now() - d) / 864e5);
    return days < 1 ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : days < 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const record = f => (f ? `<span class="rec"><b class="w">W${f.w}</b> <b class="d">D${f.d}</b> <b class="l">L${f.l}</b></span>` : '');
  const outcome = (g, seat) => {
    if (!g.result) return null;
    const w = g.result.winner, mine = g.result[seat], theirs = g.result[other(seat)];
    return { icon: w === 'draw' ? '🤝' : w === seat ? '🏆' : '😬', text: w === 'draw' ? 'Drew' : w === seat ? 'Won' : 'Lost', score: `${fmt(mine)}–${fmt(theirs)}`, resigned: g.result.resigned };
  };
  const myMove = (g, seat) => g.status !== 'done' && (g.kind === 'duel' ? g.turn === seat
    : g.kind === 'auction' ? (g.turn === 'both' || g.turn === seat) && !(g.bids_in || []).includes(seat)
    : !((g.sums || g.race || {})[seat] || {}).done);

  // Everything online needs a claimed name: that's what lets you pick up your games on any phone
  async function needAccount(root, why, q) {
    root.innerHTML = `${top('Online')}
      <div class="h2h-hero"><div class="h2h-trophy">🌐</div><h3>Play your mates online</h3>
        <p>Challenge friends to a Draft Duel or a Live Race, take your turn whenever suits you, and keep a head-to-head record.</p></div>
      <button class="btn big" id="oclaim">🔒 Claim your name to play</button>
      <p class="muted center">${why || 'Your name is how friends find you. It’s yours alone, and you can move it to a new phone with a transfer code.'}</p>
      <p class="muted center"><a href="#/h2h">📱 Or play on one phone (pass it round)</a></p>`;
    GM.$('#oclaim').onclick = async () => { const n = await GM.accountModal('Pick the name your friends will know you by.'); if (n) GM.onlinePage(root, q); };
  }

  /* ================================================================ the hub: your games and friends */
  GM.onlinePage = async function (root, q = {}) {
    stopPoll();
    if (!GM.lb.enabled) { root.innerHTML = top('Online') + '<p class="muted center">Online games need the leaderboard server, which is switched off.</p>'; return; }
    if (!GM.account()) return needAccount(root, q.join ? `You've been invited to game <b>${esc(q.join)}</b>. Claim a name and you're in.` : '', q);
    if (q.join) return join(root, q.join);
    if (q.room) return room(root, q.room, q);
    // sub-tabs keep it short: your games first, with finished games, the league and friends a tap away
    const TABS = [['games', '🎮 Games'], ['done', '✅ Finished'], ['league', '🏆 League'], ['friends', '👥 Friends']];
    let tab = TABS.some(t => t[0] === q.tab) ? q.tab : GM.store.get('onlineTab', 'games');
    root.innerHTML = `${top('Online')}
      <div class="online-me"><a href="#/settings" class="me-pic">${GM.userPic(me())}</a><span>Playing as <b>🔒 ${esc(me())}</b></span><button class="btn small" id="onew">⚔️ New game</button></div>
      <div class="seg online-tabs" id="otabs">${TABS.map(([k, l]) => `<button data-t="${k}">${l}<i class="ot-n" data-n="${k}"></i></button>`).join('')}</div>
      <div data-panel="games"><div id="olists"><p class="muted center">Loading your games…</p></div></div>
      <div data-panel="done"><div id="odone"></div></div>
      <div data-panel="league">
        <h3 class="section-title">This week<span class="more" id="lgreset"></span></h3>
        <div class="seg wrap league-modes" id="lgmode">${LEAGUE.map(([k, l]) => `<button data-v="${k}" class="${k === GM.store.get('leagueMode', 'ultimate') ? 'on' : ''}">${l.replace('📅', GM.calIcon())}</button>`).join('')}</div>
        <div id="league" class="league"><p class="muted center">Loading…</p></div></div>
      <div data-panel="friends">
        <div id="ofriends" class="friends"></div>
        <div class="join-row"><input class="input" id="ofriend" maxlength="20" placeholder="Add a friend by name" autocomplete="off"><button class="btn" id="oadd">➕ Add</button></div>
        <h3 class="section-title">Got a code?</h3>
        <div class="join-row"><input class="input" id="ocode" maxlength="5" placeholder="ABCDE" autocapitalize="characters"><button class="btn" id="ojoin">Join</button></div>
        <p class="muted center"><a href="#/h2h">📱 Play on one phone instead (pass it round)</a></p></div>`;
    const showTab = t => {
      tab = t; GM.store.set('onlineTab', t);
      GM.$$('#otabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      GM.$$('[data-panel]', root).forEach(el => { el.hidden = el.dataset.panel !== t; });
    };
    GM.$$('#otabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));
    showTab(tab);
    GM.$('#onew').onclick = () => newGame();
    // the league: you and your friends' best this week (Monday to Sunday); dailies add up every day's score
    const loadLeague = async () => {
      const mode = GM.store.get('leagueMode', 'ultimate'), el = GM.$('#league');
      const mon = new Date(); mon.setUTCHours(0, 0, 0, 0); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7) + 7);
      const days = Math.ceil((mon - Date.now()) / 864e5), rs = GM.$('#lgreset'); if (rs) rs.textContent = `resets in ${days} day${days === 1 ? '' : 's'}`;
      let rows;
      try { rows = await rpc('friends_week', { ...auth(), p_mode: mode }); } catch (e) { if (el) el.innerHTML = '<p class="muted center">Couldn’t load the league</p>'; return; }
      if (!el) return;
      const daily = ['daily', 'dchaos', 'mbdaily'].includes(mode);
      el.innerHTML = (rows || []).length > 1 ? `<ol>${rows.map((r, i) => `<li class="${r.me ? 'me' : ''} ${r.score ? '' : 'none'}"><span class="lg-pos">${r.score ? ['🥇', '🥈', '🥉'][i] || i + 1 : '–'}</span>
          <b>${GM.userPic(r.name)} ${esc(r.name)}${r.me ? ' (you)' : ''}</b><span class="lg-score">${r.score ? fmt(r.score) : 'not played'}${daily && r.games ? `<small>${r.games} day${r.games > 1 ? 's' : ''}</small>` : ''}</span></li>`).join('')}</ol>`
        : '<p class="muted center">Add some friends and the league fills up with their best scores this week.</p>';
    };
    GM.$$('#lgmode button').forEach(b => b.onclick = () => { GM.store.set('leagueMode', b.dataset.v); GM.$$('#lgmode button').forEach(x => x.classList.toggle('on', x === b)); loadLeague(); });
    loadLeague();
    GM.$('#ojoin').onclick = () => { const c = GM.$('#ocode').value.trim().toUpperCase(); if (c) join(root, c); };
    GM.$('#oadd').onclick = async () => {
      const n = GM.$('#ofriend').value.trim(); if (!n) return;
      try {
        const r = await rpc('online_add_friend', { ...auth(), p_friend: n });
        if (r === 'ok') { GM.toast(`🤝 ${esc(n)} added`); GM.$('#ofriend').value = ''; load(); }
        else GM.toast(r === 'no_user' ? `Nobody's called “${esc(n)}” yet – they need to claim that name first` : r === 'self' ? 'That’s you!' : 'Couldn’t add them');
      } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
    };
    let friends = [];
    const load = async () => {
      let games, fr;
      try { [games, fr] = await Promise.all([rpc('online_games', auth()), rpc('online_friends', auth())]); } catch (e) {
        const el = GM.$('#olists'); if (el) el.innerHTML = '<p class="muted center">Couldn’t reach the server. Check your connection.</p>'; return;
      }
      if (!GM.$('#olists')) return;
      friends = fr || [];
      const rows = (games || []).map(g => ({ g, seat: seatOf(g) })).filter(x => x.seat);
      const yours = rows.filter(x => myMove(x.g, x.seat)), theirs = rows.filter(x => x.g.status !== 'done' && !myMove(x.g, x.seat)), done = rows.filter(x => x.g.status === 'done');
      const line = ({ g, seat }) => {
        const opp = oppOf(g), k = KIND[gk(g)], st = GM.STATS[g.stat] || GM.STATS.goals, s = g.sums || {}, o = outcome(g, seat);
        const sub = o ? `${o.icon} ${o.text} ${o.score}${o.resigned ? ` (${o.resigned === seat ? 'you' : 'they'} resigned)` : ''}`
          : !opp ? `Waiting for someone to join · code <b>${g.code}</b>`
          : g.kind === 'duel' ? (g.turn === seat ? '👉 Your pick' : `⏳ ${esc(opp)}’s pick`)
          : g.kind === 'auction' ? (myMove(g, seat) ? '👉 Your bid' : `⏳ Waiting for ${esc(opp)}’s bid`)
          : `You ${(s[seat] || {}).done ? '✓ done' : `${(s[seat] || {}).n || 0}/11`} · ${esc(opp)} ${(s[other(seat)] || {}).done ? '✓ done' : `${(s[other(seat)] || {}).n || 0}/11`}`;
        return `<a class="og-row ${o ? 'res-' + o.text.toLowerCase() : ''} ${!o && myMove(g, seat) ? 'mine' : ''}" href="#/online?room=${g.code}"><span class="og-icon">${opp ? GM.userPic(opp) : ''}<i>${k.icon}</i></span>
          <span class="og-main"><b>${opp ? esc(opp) : 'Open invite'}</b><small>${k.name} · ${st.icon} ${st.name}</small><small class="og-sub">${sub}</small></span>
          <span class="og-when">${when(g.updated)}</span></a>`;
      };
      const block = (title, list, empty) => `<h3 class="section-title">${title}${list.length && list === yours ? ` <span class="count">${list.length}</span>` : ''}</h3>
        ${list.length ? `<div class="og-list">${list.map(line).join('')}</div>` : `<p class="muted center">${empty}</p>`}`;
      GM.$('#olists').innerHTML = (yours.length ? block('👉 Your move', yours, '')
          : `<div class="og-empty"><b>Nothing waiting on you</b><span>Start a game, or check back when it’s your turn.</span><button class="btn" id="onew2">⚔️ New game</button></div>`)
        + (theirs.length ? block('⏳ Their move', theirs, '') : '');
      GM.$('#odone').innerHTML = done.length ? `<div class="og-list">${done.slice(0, 30).map(line).join('')}</div>` : '<p class="muted center">No finished games yet.</p>';
      const nb = GM.$('#onew2'); if (nb) nb.onclick = () => newGame();
      // the Games tab shows how many are waiting on you; the list itself marks your moves loudly
      const n = GM.$('[data-n="games"]'); if (n) { n.textContent = yours.length || ''; n.classList.toggle('hot', !!yours.length); }
      GM.$('#ofriends').innerHTML = friends.length ? friends.map(f => `<div class="friend"><button class="f-av" data-fmenu="${esc(f.name)}" title="Options">${GM.userPic(f.name)}</button>
          <span class="f-main"><b>${esc(f.name)}</b>${f.w + f.d + f.l ? record(f) : '<small class="muted">No games yet</small>'}</span>
          <button class="btn small" data-challenge="${esc(f.name)}">⚔️ Play</button></div>`).join('')
        : '<p class="muted center">Add friends by their Goal Machine name, or send an invite code. Anyone you play is added automatically.</p>';
      GM.$$('[data-challenge]').forEach(b => b.onclick = () => newGame(b.dataset.challenge));
      // tap a friend's picture: challenge, remove them, or report their picture
      GM.$$('[data-fmenu]').forEach(b => b.onclick = () => {
        const n = b.dataset.fmenu;
        const m = GM.modal(`<div class="center">${GM.userPic(n, 'xl')}<h3>${esc(n)}</h3></div>
          <div class="actions col"><button class="btn" data-a="play">⚔️ Challenge</button><button class="btn ghost" data-a="report">🚩 Report their picture</button>
          <button class="btn ghost danger" data-a="remove">Remove friend</button><button class="btn ghost" data-close>Close</button></div>`);
        GM.$$('[data-a]', m.el).forEach(x => x.onclick = async () => {
          m.close();
          if (x.dataset.a === 'play') return newGame(n);
          if (x.dataset.a === 'remove') {
            if (!await GM.confirm(`Remove ${esc(n)} from your friends? Your record against them stays.`, 'Remove', 'Keep')) return;
            try { await rpc('online_remove_friend', { ...auth(), p_friend: n }); } catch (e) { }
            return load();
          }
          if (!await GM.confirm(`Report ${esc(n)}'s picture as offensive? If several players report it, it's removed.`, 'Report', 'Cancel')) return;
          try { const r = await rpc('report_avatar', { ...auth(), p_target: n }); GM.toast(r === 'removed' ? 'Thanks – the picture has been removed' : 'Thanks – reported'); if (r === 'removed') { GM.pics[n.toLowerCase()] = null; load(); } }
          catch (e) { GM.toast('Couldn’t reach the server – try again'); }
        });
      });
      GM.online.setWaiting(yours.length);
    };
    function newGame(opp = '') {
      let kind = GM.store.get('onlineKind', 'duel'), stat = GM.store.get('onlineStat', 'goals');
      const m = GM.modal(`<h3>⚔️ New online game</h3>
        <div class="setting"><b>Who against?</b>
          <div class="seg wrap" id="nopp">${friends.map(f => `<button data-v="${esc(f.name)}" class="${f.name === opp ? 'on' : ''}">${esc(f.name)}</button>`).join('')}
          <button data-v="" class="${!opp ? 'on' : ''}">🔗 Anyone (send a code)</button></div>
          <input class="input" id="nname" maxlength="20" placeholder="…or type their name" value="" autocomplete="off"></div>
        <div class="setting"><b>Game</b><div class="seg wrap" id="nkind">${Object.entries(KIND).map(([k, v]) => `<button data-v="${k}" class="${k === kind ? 'on' : ''}">${v.icon} ${v.name}</button>`).join('')}</div>
          <small id="nkdesc"></small></div>
        <div class="setting"><b>Stat</b><div class="seg stat-seg" id="nstat">${Object.entries(GM.STATS).map(([k, s]) => `<button data-v="${k}" class="${k === stat ? 'on' : ''}"><i class="sb-ico">${s.icon}</i>${s.name}</button>`).join('')}</div></div>
        <div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="ngo">Start ⚽</button></div>`);
      const desc = () => { GM.$('#nkdesc', m.el).textContent = kind === 'duel'
        ? 'Take turns picking from the same five players each spin. The better XI wins 60 points, the better squad rating 40.'
        : kind === 'scout' ? 'A Draft Duel on scouting reports: no names, just a few clues on each player. Scout, blindfold and swap cards to play once each.'
        : kind === 'target' ? 'A new target every game (some much harder than others). You both chase it on the same spins, whenever suits you – whoever finishes closest wins.'
        : kind === 'chaos' ? 'Ultimate Wildcard CHAOS on the same spins, events and storms. Most CHAOS points (your total plus every bonus) wins.'
        : kind === 'auction' ? '£200m each and one player per lot. Bid in secret: the higher bid signs him. Tallies stay hidden until full time. 60 points for the bigger total, 40 for the better squad rating.'
        : 'You both build an Ultimate XI on the same spins, whenever you like. 50 points for the bigger total, 30 for the better squad rating, 20 for the quicker XI.'; };
      desc();
      const seg = (id, set) => GM.$$(`#${id} button`, m.el).forEach(b => b.onclick = () => { set(b.dataset.v); GM.$$(`#${id} button`, m.el).forEach(x => x.classList.toggle('on', x === b)); desc(); });
      seg('nopp', v => { opp = v; GM.$('#nname', m.el).value = ''; });
      seg('nkind', v => { kind = v; GM.store.set('onlineKind', v); });
      seg('nstat', v => { stat = v; GM.store.set('onlineStat', v); });
      GM.$('#ngo', m.el).onclick = async () => {
        const typed = GM.$('#nname', m.el).value.trim(), who = typed || opp;
        const code = await create(kind, stat, who);
        if (code) { m.close(); location.hash = '#/online?room=' + code; }
      };
    }
    load();
    poll = setInterval(load, 20000);
  };

  async function create(kind, stat, opp) {
    try {
      const r = await rpc('online_create', { ...auth(), p_kind: serverKind(kind), p_stat: stat, p_opp: opp || null, p_variant: serverKind(kind) === kind ? null : kind });
      if (r && r.code) { if (opp) GM.toast(`⚔️ Challenge sent to ${esc(opp)}`); return r.code; }
      GM.toast(r && r.error === 'no_user' ? `Nobody's called “${esc(opp)}” yet` : r && r.error === 'self' ? 'You can’t play yourself!' : r && r.error === 'auth' ? 'Your name isn’t set up on this phone' : 'Couldn’t start the game');
    } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
    return null;
  }

  async function join(root, code) {
    root.innerHTML = top('Online', '#/online') + '<p class="muted center">Joining…</p>';
    try {
      const r = await rpc('online_join', { ...auth(), p_code: code.toUpperCase() });
      if (r && r.code) { location.replace('#/online?room=' + r.code); return; }
      GM.toast(r && r.error === 'full' ? 'That game already has two players' : r && r.error === 'no_room' ? 'No game with that code' : 'Couldn’t join');
    } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
    location.replace('#/online');
  }

  /* ================================================================ a game */
  async function room(root, code, q) {
    let last = '';
    const tick = async () => {
      let r;
      try { r = await rpc('online_get', { p_code: code, p_user: me() }); } catch (e) { return; }
      if (!r) { stopPoll(); root.innerHTML = top('Online', '#/online') + '<p class="muted center">This game has gone. Unanswered invites are cleared after two weeks.</p>'; return; }
      const seat = seatOf(r);
      if (!seat) { root.innerHTML = top('Online', '#/online') + `<p class="muted center">This game is between ${esc(r.host)} and ${esc(r.guest || '…')}.</p>`; stopPoll(); return; }
      const sig = JSON.stringify([r.guest, r.moves.length, r.race, r.status, r.turn, r.bids_in, r.kind === 'duel' ? Math.floor(r.now - ((r.seen || {})[other(seat)] || 0)) > 10 : 0]);
      if (sig === last) return;
      last = sig;
      if (r.kind === 'race') race(root, r, seat, q);
      else if (r.kind === 'auction') GM.market.auctionOnline(root, r, seat, { rpc, auth, summary, top: (t, back) => top(t, back), inviteBar, wireInvite, resignButton, refresh: () => GM.online.refresh && GM.online.refresh() });
      else duel(root, r, seat);
      if (r.status === 'done' || r.status === 'declined') { over = true; clearInterval(poll); poll = null; }
    };
    let over = false;
    root.innerHTML = top('Online', '#/online') + '<p class="muted center">Connecting…</p>';
    await tick();
    clearInterval(poll); poll = over ? null : setInterval(tick, 2000);
    GM.online.refresh = () => { last = ''; return tick(); };
  }
  GM.online = { refresh: null };

  const inviteBar = r => (r.guest ? '' : `<div class="banner invite">🔗 Nobody has joined yet. Send them code <b>${r.code}</b>
      <button class="btn small" id="oshare">📤 Send invite</button></div>`);
  function wireInvite(root, r) {
    const b = GM.$('#oshare', root);
    if (b) b.onclick = () => GM.share(`⚽ Goal Machine – ${KIND[gk(r)].name} me! Code ${r.code}`, GM.baseUrl() + '#/online?join=' + r.code);
  }
  function resignButton(root, r, seat) {
    const b = GM.$('#oresign', root);
    if (!b) return;
    b.onclick = async () => {
      const started = r.race[seat] || r.moves.some(m => m.s === seat);
      const ok = await GM.confirm(!r.guest ? 'Cancel this invite?' : started ? `Resign? ${esc(oppOf(r))} will win this one.` : `Decline ${esc(oppOf(r))}’s challenge?`);
      if (!ok) return;
      try { await rpc('online_resign', { ...auth(), p_code: r.code }); } catch (e) { }
      GM.store.set('racep:' + r.code, null);
      location.hash = '#/online';
    };
  }

  /* ---------------------------------------------------------------- Live Race */
  function race(root, r, seat, q) {
    const them = other(seat), opp = r[them], mine = r.race[seat] || {}, theirs = r.race[them] || {};
    const S = GM.draft.state(), inDraft = !!(S && S.online && S.online.code === r.code && GM.$('#oppbar, #race-result', root));
    if (!mine.done && r.status !== 'done') {
      if (!inDraft) GM.draft.start(root, raceMode(r), { seed: r.seed, stat: r.stat, online: { code: r.code, seat, opp: opp || 'someone' } });
      GM.chaosLook(r.variant === 'chaos');
      if (r.variant === 'chaos') GM.sound.scene('chaos');
      const bar = GM.$('#oppbar', root);
      const theirScore = r.variant === 'chaos' ? `${fmt(theirs.c || 0)} pts` : r.variant === 'target' ? `${theirs.n ? `${fmt(theirs.d || 0)} off` : '–'}` : `${fmt(theirs.t || 0)} ${GM.STATS[r.stat].label}`;
      if (opp) GM.online.setOppBar(r, opp, theirs, `${KIND[gk(r)].icon} <b>${esc(opp)}</b> ${theirScore} · ${theirs.n || 0}/11${theirs.done ? ' ✓' : ''}`);
      if (bar && opp) bar.innerHTML = GM.online.oppBar(r.code);
      else if (bar) bar.innerHTML = opp ? ''
        : `<span>🔗 Waiting for someone to join (code <b>${r.code}</b>) – play your XI now</span> <button class="btn small" id="oshare">📤</button>`;
      wireInvite(root, r);
      return;
    }
    // you've finished: stay on your full-time report until you ask for the comparison
    const onReport = inDraft && S.phase === 'done' && !q.v;
    if (onReport) {
      const res = GM.$('#race-result', root);
      if (res) res.innerHTML = r.result ? `<div class="banner race-final">${resultLine(r, seat)}</div>`
        : `<div class="banner">⏳ ${opp ? `${esc(opp)} is on ${theirs.n || 0}/11 – tap below to watch their XI` : 'Waiting for someone to join'}</div>`;
      if (r.result && !root.dataset.played) { root.dataset.played = 1; GM.sound.play(r.result.winner === seat ? 'fanfare' : 'fulltime'); }
      return;
    }
    summary(root, r, seat);
  }
  // Your opponent's live feed in a race: their score, and each signing as it lands (tap for their whole XI).
  // Kept here so the draft can redraw it on every tap without losing it.
  const feed = {};
  GM.online.setOppBar = function (r, opp, theirs, line) {
    const f = feed[r.code] || (feed[r.code] = {}), lp = theirs.lp, key = lp ? lp[1] + ':' + lp[2] : '';
    const fresh = !!(key && f.key != null && f.key !== key);  // a new signing since we last looked
    if (fresh) { f.flashUntil = Date.now() + 2500; GM.buzz(12); }
    f.key = key; f.theirs = theirs; f.opp = opp; f.stat = r.stat; f.variant = r.variant;
    const p = lp && GM.byPk.get(lp[1]);
    f.html = `<button class="ob-btn" data-oppxi="${r.code}"><span class="ob-line">${line}</span>${p ? `<span class="ob-last">✍️ ${esc(p.name.split(' ').slice(-1)[0])} <i>${fmt(lp[2])}</i></span>` : ''}<span class="ob-go">XI ›</span></button>`;
  };
  GM.online.oppBar = code => {
    const f = feed[code];
    if (!f) return '';
    return f.html.replace('class="ob-btn"', `class="ob-btn ${f.flashUntil > Date.now() ? 'flash' : ''}"`);
  };
  function showOppXi(code) {
    const f = feed[code]; if (!f) return;
    const st = GM.STATS[f.stat] || GM.STATS.goals, x = f.theirs.x || FORMATION.map(pos => [pos]), lp = f.theirs.lp;
    const cell = ([pos, pk, v]) => { const p = pk && GM.byPk.get(pk);
      return `<div class="ox ${p ? 'on' : ''} ${lp && pk === lp[1] ? 'latest' : ''}"><span class="pos pos-${GM.GROUP[pos]}">${pos}</span>${p ? `${GM.avatar(p)}<b>${esc(p.name.split(' ').slice(-1)[0])}</b><i>${fmt(v)}</i>` : '<b class="muted">–</b>'}</div>`; };
    const rows = ['F', 'M', 'D', 'G'].map(g => x.filter(c => GM.GROUP[c[0]] === g)).filter(r => r.length);
    GM.modal(`<h3>${esc(f.opp)}’s XI</h3><p class="muted center small">${f.theirs.n || 0}/11 signed · ${fmt(f.theirs.t || 0)} ${st.label}${f.variant === 'chaos' ? ` · ${fmt(f.theirs.c || 0)} CHAOS pts` : ''}${f.variant === 'target' && f.theirs.n ? ` · ${fmt(f.theirs.d || 0)} off the target` : ''}</p>
      <div class="opp-pitch">${rows.map(r => `<div class="op-row">${r.map(cell).join('')}</div>`).join('')}</div>
      <div class="row"><button class="btn" data-close>Back to my XI</button></div>`);
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-oppxi]'); if (b) showOppXi(b.dataset.oppxi); });

  // called by the draft engine after every signing and at full time: your running total, XI, rating and time taken
  GM.online.pushRace = function (S) {
    const o = S.online;
    if (!o || !GM.account()) return;
    const now = Date.now();
    o.ms = (o.ms || 0) + Math.min(90000, Math.max(0, now - (o.lastT || now)));  // time spent playing, not time away
    o.lastT = now;
    const xi = S.xi.filter(s => s.p != null).map(s => ({ pos: s.pos, player: GM.players[s.p] }));
    const sc = GM.draft.score(S);
    const sum = { t: sc.t, n: xi.length, done: S.phase === 'done', r: xi.length ? GM.teamRating(xi).score : 0, ms: o.ms,
      ...(S.mode === 'target' ? { tg: S.target, d: Math.abs(S.target - sc.t) } : S.mode === 'chaos' ? { c: sc.total } : {}),
      x: S.xi.map(s => (s.p != null ? [s.pos, GM.players[s.p].pk, s.g] : [s.pos])) };
    const ls = S.last != null && S.xi.find(s => s.p === S.last);
    if (ls) sum.lp = [ls.pos, GM.players[ls.p].pk, ls.g];  // your latest signing, for your opponent's live feed
    GM.store.set('racep:' + o.code, { ...S, rules: undefined });
    rpc('online_move', { ...auth(), p_code: o.code, p_seq: 0, p_move: null, p_sum: sum, p_turn: null })
      .then(() => GM.online.refresh && GM.online.refresh()).catch(() => { });
  };

  const resultLine = (r, seat) => {
    const o = outcome(r, seat), opp = r[other(seat)];
    return o.resigned ? (o.resigned === seat ? `🏳️ You resigned – ${esc(opp)} wins` : `🏆 ${esc(opp)} resigned – you win`)
      : `${o.icon} ${o.text === 'Won' ? 'You win' : o.text === 'Lost' ? `${esc(opp)} wins` : 'A draw'} · ${o.score} match points`;
  };

  /* ---------------------------------------------------------------- the comparison (both games) */
  function summary(root, r, seat) {
    const them = other(seat), opp = r[them] || 'Waiting…', st = GM.STATS[r.stat];
    const duelXi = r.kind === 'duel' ? duelState(r).xi : r.kind === 'auction' ? GM.market.auctionState(r.seed, r.moves).xi : null;
    const team = s => {
      if (duelXi) return duelXi[s].map(x => { const p = x.k && GM.byPk.get(x.k); return { pos: x.pos, p, v: p ? p[st.key] : null }; });
      const sum = r.race[s] || {};
      return (sum.x || FORMATION.map(pos => [pos])).map(([pos, pk, v]) => ({ pos, p: pk ? GM.byPk.get(pk) : null, v: pk ? v : null }));
    };
    const sums = s => {
      const t = team(s), xi = t.filter(x => x.p).map(x => ({ pos: x.pos, player: x.p }));
      const base = r.race[s] || {};
      return { t: duelXi ? t.reduce((a, x) => a + (x.v || 0), 0) : base.t || 0, r: xi.length ? GM.teamRating(xi).score : 0, ms: base.ms, n: xi.length, done: !!base.done,
        d: base.d, c: base.c || 0, tg: base.tg };
    };
    const A = sums(seat), B = sums(them);
    const weights = r.kind === 'race' ? [50, 30, 20] : [60, 40, 0];
    const mmss = ms => (ms == null ? '–' : `${Math.floor(ms / 60000)}m ${String(Math.round(ms / 1000) % 60).padStart(2, '0')}s`);
    // Target and CHAOS Races are all-or-nothing: closest to the target, or most CHAOS points
    const tg = A.tg || B.tg, off = x => (x.d == null ? '–' : x.d === 0 ? '🎯 bullseye' : `${fmt(x.d)} off`);
    const rows = r.variant === 'target' ? [[`🎯 Closest to ${tg ? fmt(tg) : 'the target'}`, 100, `${fmt(A.t)} · ${off(A)}`, `${fmt(B.t)} · ${off(B)}`, Math.sign((B.d ?? 1e9) - (A.d ?? 1e9))]]
      : r.variant === 'chaos' ? [['🌪️ Most CHAOS points', 100, fmt(A.c), fmt(B.c), Math.sign(A.c - B.c)]]
      : [
      [`${st.icon} Bigger total`, weights[0], fmt(A.t), fmt(B.t), Math.sign(A.t - B.t)],
      ['⭐ Better squad rating', weights[1], A.r, B.r, Math.sign(A.r - B.r)],
    ];
    if (weights[2] && !r.variant) rows.push(['⚡ Quicker XI', weights[2], mmss(A.ms), mmss(B.ms), Math.sign((B.ms || 1e12) - (A.ms || 1e12))]);
    const bothDone = A.done && B.done;
    const pts = r.result ? [r.result[seat], r.result[them]] : null;
    const side = (t, cls) => `<div class="cmp-xi ${cls}">${t.map(x => `<div class="cx ${x.p ? '' : 'empty'}"><span class="pos pos-${GM.GROUP[x.pos]}">${x.pos}</span>
        <b>${x.p ? esc(x.p.name.split(' ').slice(-1)[0]) : '–'}</b><i>${x.p ? fmt(x.v) : ''}</i></div>`).join('')}</div>`;
    root.innerHTML = `${top(KIND[gk(r)].name, '#/online')}
      <div class="h2h-board duel-board">
        <div class="h2h-team p1">${GM.userPic(me(), 'board')}<b>You</b><strong>${pts ? fmt(pts[0]) : fmt(r.variant === 'chaos' ? A.c : A.t)}</strong><small>${pts ? 'points' : `${A.n}/11`}</small></div>
        <div class="h2h-mid"><small>${r.variant === 'target' && tg ? `🎯 ${fmt(tg)} ${st.label}` : `${st.icon} ${st.name}`}</small><span>VS</span><small id="orec"></small></div>
        <div class="h2h-team p2">${r[them] ? GM.userPic(opp, 'board') : ''}<b>${esc(opp)}</b><strong>${pts ? fmt(pts[1]) : fmt(r.variant === 'chaos' ? B.c : B.t)}</strong><small>${pts ? 'points' : `${B.n}/11${B.done ? ' ✓' : ''}`}</small></div></div>
      ${r.result ? `<div class="banner race-final">${resultLine(r, seat)}</div>`
        : `<div class="banner">⏳ ${r.guest ? `${esc(opp)} is still building their XI (${B.n}/11). You can watch it fill up here.` : 'Nobody has joined yet.'}</div>`}
      ${inviteBar(r)}
      <table class="cmp-points"><tr><th></th><th>You</th><th>${esc(opp)}</th><th>Pts</th></tr>
        ${rows.map(([label, w, a, b, s]) => `<tr><td>${label}</td><td class="${bothDone && s > 0 ? 'won' : ''}">${a}</td><td class="${bothDone && s < 0 ? 'won' : ''}">${b}</td><td>${w}</td></tr>`).join('')}</table>
      <div class="cmp"><div><h4>You</h4>${side(team(seat), 'p1')}</div><div><h4>${esc(opp)}</h4>${side(team(them), 'p2')}</div></div>
      <div class="actions col">
        ${r.result && r.guest ? `<button class="btn big" id="orematch">🔁 Rematch ${esc(opp)}</button><button class="btn ghost" id="oshareres">📤 Share the result</button>` : ''}
        ${A.n ? '<button class="btn ghost" id="osharepic">🖼️ Share a picture of your XI</button>' : ''}
        ${!r.result && r.status !== 'declined' ? `<button class="btn ghost small" id="oresign">🏳️ ${r.guest ? 'Resign' : 'Cancel invite'}</button>` : ''}
        <a class="btn ghost" href="#/online">🌐 All your games</a></div>`;
    wireInvite(root, r);
    resignButton(root, r, seat);
    const rm = GM.$('#orematch', root);
    if (rm) rm.onclick = async () => { const c = await create(gk(r), r.stat, opp); if (c) location.hash = '#/online?room=' + c; };
    const sh = GM.$('#oshareres', root);
    if (sh) sh.onclick = () => GM.share(`⚽ Goal Machine ${KIND[gk(r)].name} v ${opp}\n${resultLine(r, seat).replace(/<[^>]+>/g, '')}\n${st.icon} ${fmt(A.t)} – ${fmt(B.t)} ${st.label}`, GM.baseUrl());
    const sp = GM.$('#osharepic', root);
    if (sp) sp.onclick = () => GM.shareImage(GM.teamPicture(team(seat).map(x => ({ pos: x.pos, p: x.p, v: x.v })), {
      title: `${KIND[gk(r)].name} v ${opp}`, sub: r.result ? resultLine(r, seat).replace(/<[^>]+>/g, '') : `${st.icon} ${st.name}`, total: A.t, totalLabel: st.label }),
      `⚽ Goal Machine ${KIND[gk(r)].name} v ${opp}`);
    if (r.result && !root.dataset.played) { root.dataset.played = r.code; GM.sound.play(r.result.winner === seat ? 'fanfare' : 'fulltime'); }
    if (r.guest) rpc('online_friends', auth()).then(fr => {
      const f = (fr || []).find(x => x.name === opp), el = GM.$('#orec', root);
      if (el && f) el.innerHTML = `Record W${f.w} D${f.d} L${f.l}`;
    }).catch(() => { });
  }

  /* ---------------------------------------------------------------- Draft Duel */
  // Five players a spin, seeded by the game and spin number: two who fit each player's open positions and one more,
  // shuffled. Whoever picks first, the other always has at least one player who fits.
  function duelReels(seed, spin, active, open, used) {
    const rng = GM.rng(`${seed}|duel5|${spin}`), P = GM.players, out = [];
    const draw = poss => {
      for (let t = 0; t < 6000; t++) {
        const p = P[Math.floor(rng() * P.length)];
        if (!used.has(p.pk) && !out.includes(p) && p.poss.some(x => poss.includes(x))) return p;
      }
      return null;
    };
    const need = active.length === 1 ? [[active[0], 3]] : active.map(s => [s, 2]);
    need.forEach(([seat, n]) => { for (let k = 0; k < n; k++) { const p = draw(open(seat)); if (p) out.push(p); } });
    if (active.length > 1) { const p = draw([...new Set(active.flatMap(open))]); if (p) out.push(p); }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out.map(p => p.pk);
  }
  // Scout Duel cards: one use each per game
  const SCOUT_CARDS = {
    scout: { icon: '🔍', name: 'Scout', desc: 'See the full report on one player (just for you)' },
    blind: { icon: '🙈', name: 'Blindfold', desc: 'Your opponent sees positions only on their next pick' },
    swap: { icon: '🔄', name: 'Swap', desc: 'Swap one of your signings with one of theirs in the same position' },
  };
  // Each player's scouting report shows the same few clues to both players (seeded by the game and the player)
  const CLUES = ['flag', 'clubs', 'years', 'first', 'apps', 'initials'];
  function cluesFor(seed, k) {
    const rng = GM.rng(`${seed}|clue|${k}`), pool = CLUES.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return rng() < 0.08 ? ['name', pool[0]] : pool.slice(0, rng() < 0.5 ? 2 : 3);  // now and then, the name itself
  }
  const appsBand = a => (a < 100 ? '50–99' : a < 200 ? '100–199' : a < 300 ? '200–299' : a < 400 ? '300–399' : '400+');
  function clueHtml(c, p) {
    switch (c) {
      case 'flag': return `<span class="clue">${GM.flag(p.nat)} ${esc(p.nat)}</span>`;
      case 'clubs': return `<span class="clue chips">${p.clubs.map(x => GM.clubChip(x)).join('')}</span>`;
      case 'years': return `<span class="clue">📅 ${GM.era(p)}</span>`;
      case 'first': return `<span class="clue">🌱 Started at ${GM.clubChip(p.clubs[0])}</span>`;
      case 'apps': return `<span class="clue">🏃 ${appsBand(p.apps)} apps</span>`;
      case 'initials': return `<span class="clue">🔤 ${esc(GM.initials(p.name).split('').join('. '))}.</span>`;
      default: return '';
    }
  }

  function duelState(r) {
    const st = { xi: { host: FORMATION.map(pos => ({ pos, k: null })), guest: FORMATION.map(pos => ({ pos, k: null })) }, used: new Set(), done: false,
      // Scout Duel: who has used which card, which players each has scouted, and who is blindfolded for their next pick
      // hand: how many of each card each player holds (one of each to start; bonus cards on the reels add more)
      hand: { host: { scout: 1, blind: 1, swap: 1 }, guest: { scout: 1, blind: 1, swap: 1 } }, scouted: { host: new Set(), guest: new Set() }, blind: {} };
    const open = seat => st.xi[seat].filter(s => !s.k).map(s => s.pos);
    const wildcard = (m, seat) => {
      if (!SCOUT_CARDS[m.w] || !(st.hand[seat][m.w] > 0)) return;
      st.hand[seat][m.w]--;
      if (m.w === 'scout') st.scouted[seat].add(m.k);
      if (m.w === 'blind') st.blind[other(seat)] = true;
      if (m.w === 'swap') {
        const a = st.xi[seat][m.a], b = st.xi[other(seat)][m.b];
        if (a && b && a.k && b.k && a.pos === b.pos) [a.k, b.k] = [b.k, a.k];
      }
    };
    let i = 0;
    for (let spin = 0; spin < 80; spin++) {
      const order = spin % 2 === 0 ? ['guest', 'host'] : SEATS;  // the challenged player picks first
      const active = order.filter(s => open(s).length);
      if (!active.length) break;
      const reels = duelReels(r.seed, spin, active, open, st.used), takenNow = {};
      // Scout Duel: from the 3rd spin, about one spin in three also offers a bonus card, which you can take instead of a player
      if (r.variant === 'scout' && spin >= 2) {
        const rb = GM.rng(`${r.seed}|bonus|${spin}`);
        if (rb() < 0.34) { const types = Object.keys(SCOUT_CARDS); reels.splice(Math.floor(rb() * (reels.length + 1)), 0, 'card:' + types[Math.floor(rb() * types.length)]); }
      }
      for (const seat of active) {
        while (i < r.moves.length && r.moves[i].w) wildcard(r.moves[i++], seat);  // cards don't use up your turn
        if (i >= r.moves.length) return Object.assign(st, { spin, reels, turn: seat, first: active[0], takenNow, open });
        const m = r.moves[i++], slot = m.k != null && st.xi[seat][m.slot];
        st.blind[seat] = false;  // a blindfold lasts one pick
        if (typeof m.k === 'string' && m.k.startsWith('card:')) {  // took the bonus card: it goes in their hand
          if (reels.includes(m.k) && !takenNow[m.k]) { st.hand[seat][m.k.slice(5)] = (st.hand[seat][m.k.slice(5)] || 0) + 1; takenNow[m.k] = seat; }
          continue;
        }
        // a recorded pick stands even if a weekly data update has changed the reels since
        if (slot && !slot.k && GM.byPk.get(m.k) && !st.used.has(m.k)) { slot.k = m.k; st.used.add(m.k); takenNow[m.k] = seat; }
      }
    }
    return Object.assign(st, { done: true, open, turn: null });
  }
  const duelTotal = (xi, stat) => xi.reduce((a, s) => a + (s.k ? GM.byPk.get(s.k)[GM.STATS[stat].key] : 0), 0);
  const duelSum = (st, seat, stat) => {
    const xi = st.xi[seat].filter(s => s.k).map(s => ({ pos: s.pos, player: GM.byPk.get(s.k) }));
    return { t: duelTotal(st.xi[seat], stat), n: xi.length, done: xi.length === 11, r: xi.length ? GM.teamRating(xi).score : 0 };
  };

  function duel(root, r, you) {
    const st = duelState(r), them = other(you), opp = r[them];
    if (st.done || r.status === 'done' || r.status === 'declined') return summary(root, r, you);
    clearInterval(timer); timer = null;
    const stat = GM.STATS[r.stat], my = st.xi[you], myOpen = st.open(you);
    const mineNow = st.turn === you;
    const live = opp && r.seen && r.now - (r.seen[them] || 0) < 10;
    GM.app('keepAwake', !!live);  // don't let the screen sleep mid-duel
    const fits = p => p.poss.some(x => myOpen.includes(x));
    const scoutGame = r.variant === 'scout', blindNow = scoutGame && mineNow && st.blind[you];
    const scoutCard = (k, p, by, ok, can) => {
      const clues = cluesFor(r.seed, k), known = by || st.scouted[you].has(k) || clues.includes('name');
      return `<button class="duel-card scout ${by ? 'taken' : ''} ${!by && !ok ? 'nofit' : ''} ${st.scouted[you].has(k) ? 'scouted' : ''}" data-pick="${esc(k)}" ${can ? '' : 'disabled'}>
        ${by ? `<span class="dc-tag">✍️ ${by === you ? 'You' : esc(opp)}</span>` : !ok ? '<span class="dc-tag">No space</span>' : ''}
        ${known ? GM.avatar(p) : '<span class="avatar mystery"><b>?</b></span>'}<b>${known ? esc(p.name) : 'Unknown player'}</b>
        <span class="dc-meta">${GM.posBadges(p)}</span>
        ${blindNow && !known ? '<small class="clue">🙈 Blindfolded</small>' : known && (by || st.scouted[you].has(k))
          ? `<small>${GM.flag(p.nat)} ${GM.era(p)}</small><span class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</span>`
          : clues.filter(c => c !== 'name').map(c => clueHtml(c, p)).join('')}</button>`;
    };
    const bonusCard = k => {
      const c = SCOUT_CARDS[k.slice(5)], by = st.takenNow[k];
      return `<button class="duel-card bonus-card ${by ? 'taken' : ''}" data-pick="${esc(k)}" ${mineNow && !by ? '' : 'disabled'}>
        ${by ? `<span class="dc-tag">✍️ ${by === you ? 'You' : esc(opp)}</span>` : '<span class="dc-tag">🃏 Bonus card</span>'}
        <span class="bc-icon">${c.icon}</span><b>${c.name}</b><small>${c.desc}</small><span class="bc-note">Take it instead of a player</span></button>`;
    };
    const card = k => {
      if (k.startsWith('card:')) return bonusCard(k);
      const p = GM.byPk.get(k), by = st.takenNow[k], ok = fits(p), can = mineNow && !by && ok;
      if (scoutGame) return scoutCard(k, p, by, ok, can);
      const clubs = p.clubs.slice(0, 3).map(c => GM.clubChip(c)).join('') + (p.clubs.length > 3 ? `<small>+${p.clubs.length - 3}</small>` : '');
      return `<button class="duel-card ${by ? 'taken' : ''} ${!by && !ok ? 'nofit' : ''}" data-pick="${esc(k)}" ${can ? '' : 'disabled'}>
        ${by ? `<span class="dc-tag">✍️ ${by === you ? 'You' : esc(opp)}</span>` : !ok ? '<span class="dc-tag">No space</span>' : ''}
        ${GM.avatar(p)}<b>${esc(p.name)}</b><span class="dc-meta">${GM.posBadges(p)}</span><small>${GM.flag(p.nat)} ${GM.era(p)}</small><span class="chips">${clubs}</span></button>`;
    };
    const pitch = xi => `<div class="duel-xi">${xi.map(s => {
      const p = s.k ? GM.byPk.get(s.k) : null;
      return `<div class="dx ${p ? 'on' : ''}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span>${p ? `<b>${esc(p.name.split(' ').slice(-1)[0])}</b><i>${scoutGame ? '?' : p[stat.key]}</i>` : '<b class="muted">–</b>'}</div>`;
    }).join('')}</div>`;
    const tMe = duelTotal(my, r.stat), tThem = duelTotal(st.xi[them], r.stat);
    const isCard = k => k.startsWith('card:');
    const noFit = mineNow && !st.reels.some(k => !st.takenNow[k] && (isCard(k) || fits(GM.byPk.get(k))));
    const hand = st.hand[you], held = Object.values(hand).reduce((a, n) => a + n, 0);
    // your cards, big and above the players (they were easy to miss tucked under the reels)
    const handHtml = `<div class="scout-hand ${mineNow && held ? 'live' : ''}"><div class="sh-title">🃏 Your cards <span>${!held ? 'all played – grab bonus cards from the reels' : mineNow ? 'tap one to play it (it doesn’t use your pick)' : 'use them on your turn'}</span></div>
      <div class="sh-cards">${Object.entries(SCOUT_CARDS).map(([w, c]) => `<button class="sh-card" data-wild="${w}" ${mineNow && hand[w] > 0 ? '' : 'disabled'}>
        <span class="sh-icon">${c.icon}</span><b>${c.name}</b><small>${c.desc}</small>${hand[w] > 0 ? `<i class="sh-n">×${hand[w]}</i>` : ''}</button>`).join('')}</div></div>`;
    root.innerHTML = `${top(KIND[gk(r)].name, '#/online')}
      <div class="h2h-board duel-board">
        <div class="h2h-team p1">${GM.userPic(me(), 'board')}<b>You</b><strong>${scoutGame ? '?' : tMe}</strong><small>${11 - myOpen.length}/11</small></div>
        <div class="h2h-mid"><small>${stat.icon} ${stat.name}</small><span>VS</span><small>${live ? '🟢 Both here' : 'Take your time'}</small></div>
        <div class="h2h-team p2">${opp ? GM.userPic(opp, 'board') : ''}<b>${esc(opp || '…')}</b><strong>${scoutGame ? '?' : tThem}</strong><small>${11 - st.open(them).length}/11</small></div></div>
      ${inviteBar(r)}
      <div class="duel-turn ${mineNow ? 'mine' : ''}">${mineNow ? (st.first === you ? '👉 Your pick – first choice this spin' : '👉 Your pick – from what’s left') : `⏳ ${esc(opp || 'Your opponent')} is picking…${live ? '' : ' They’ll see it’s their turn next time they open the game.'}`}
        <small>Spin ${st.spin + 1}</small>${mineNow && live ? `<span class="clock" id="dclock">${PICK_SECONDS}</span>` : ''}</div>
      ${blindNow ? `<div class="banner">🙈 ${esc(opp)} blindfolded you: positions only this pick</div>` : ''}
      ${scoutGame ? handHtml : ''}
      <div class="duel-cards">${st.reels.map(card).join('')}</div>
      ${noFit ? '<div class="actions"><button class="btn ghost" id="dpass">None of these fit – pass</button></div>' : ''}
      <h3 class="section-title">Your XI</h3>${pitch(my)}
      <details class="set" open><summary><span>${esc(opp || 'Their')}'s XI</span><span>${scoutGame ? 'totals at full time' : `${tThem} ${stat.label}`}</span></summary>${pitch(st.xi[them])}</details>
      <div class="actions"><button class="btn ghost small" id="oresign">🏳️ ${r.guest ? 'Resign' : 'Cancel invite'}</button></div>`;
    wireInvite(root, r);
    resignButton(root, r, you);
    GM.$$('[data-pick]:not([disabled])', root).forEach(b => b.onclick = () => (scouting ? scoutOne(b.dataset.pick) : pick(b.dataset.pick)));
    let scouting = false;
    const scoutOne = k => { scouting = false; if (isCard(k)) return pick(k); send({ w: 'scout', k }); };
    GM.$$('[data-wild]:not([disabled])', root).forEach(b => b.onclick = () => {
      const w = b.dataset.wild;
      if (w === 'scout') {
        scouting = true; GM.toast('🔍 Tap a player to see their full report');
        GM.$$('.duel-card.scout', root).forEach(c => { if (!st.takenNow[c.dataset.pick] && !isCard(c.dataset.pick)) { c.disabled = false; c.classList.add('pick-me'); } });
        return;
      }
      if (w === 'blind') return GM.confirm(`🙈 Blindfold ${esc(opp)}? They’ll see positions only on their next pick.`).then(ok => ok && send({ w: 'blind' }));
      // swap: one of yours for one of theirs in the same position
      const pairs = [];
      my.forEach((a, ai) => a.k && st.xi[them].forEach((b, bi) => { if (b.k && b.pos === a.pos) pairs.push([ai, bi]); }));
      if (!pairs.length) return GM.toast('Nothing to swap yet – you both need a player in the same position');
      const nm = k => esc(GM.byPk.get(k).name);
      const m = GM.modal(`<h3>🔄 Swap a player</h3><p class="muted">Give ${esc(opp)} one of yours and take theirs in the same position.</p>
        <div class="swap-list">${pairs.map(([ai, bi]) => `<button class="btn ghost" data-swap="${ai},${bi}"><span class="pos pos-${GM.GROUP[my[ai].pos]}">${my[ai].pos}</span> ${nm(my[ai].k)} ⇄ <b>${nm(st.xi[them][bi].k)}</b></button>`).join('')}</div>
        <div class="row"><button class="btn ghost" data-close>Cancel</button></div>`);
      GM.$$('[data-swap]', m.el).forEach(x => x.onclick = () => { const [a, bb] = x.dataset.swap.split(',').map(Number); m.close(); send({ w: 'swap', a, b: bb }); });
    });
    const ps = GM.$('#dpass', root); if (ps) ps.onclick = () => send({ k: null, slot: null });
    if (mineNow && root.dataset.lastTurn !== `${r.code}:${r.moves.length}`) { root.dataset.lastTurn = `${r.code}:${r.moves.length}`; GM.sound.play('sting'); GM.buzz(30); }
    // the pick clock: only when you're both in the game; run out and the game picks for you
    if (mineNow && live) {
      const key = `${r.code}:${r.moves.length}`, started = GM.online._clock && GM.online._clock.key === key ? GM.online._clock.t : Date.now();
      GM.online._clock = { key, t: started };
      const tickClock = () => {
        const left = Math.max(0, PICK_SECONDS - Math.floor((Date.now() - started) / 1000)), el = GM.$('#dclock', root);
        if (el) { el.textContent = left; el.classList.toggle('hurry', left <= 5); }
        if (left <= 5 && left > 0) GM.sound.play('tick');
        if (left === 0) {
          clearInterval(timer); timer = null;
          GM.$$('.modal-wrap').forEach(m => m.remove());
          const options = st.reels.filter(k => !isCard(k) && !st.takenNow[k] && fits(GM.byPk.get(k)));
          if (!options.length) return send({ k: null, slot: null });
          const k = options[Math.floor(Math.random() * options.length)];
          GM.toast(`⏰ Time’s up – you got ${esc(GM.byPk.get(k).name)}`);
          send({ k, slot: my.findIndex(s => !s.k && GM.byPk.get(k).poss.includes(s.pos)) });
        }
      };
      tickClock();
      timer = setInterval(tickClock, 1000);
    }

    function pick(k) {
      if (isCard(k)) return send({ k, slot: null });  // a bonus card goes straight into your hand
      const p = GM.byPk.get(k), slots = my.map((s, i) => i).filter(i => !my[i].k && p.poss.includes(my[i].pos));
      const byPos = [...new Map(slots.map(i => [my[i].pos, i])).values()];
      if (byPos.length === 1) return send({ k, slot: byPos[0] });
      const known = r.variant !== 'scout' || st.scouted[you].has(k) || cluesFor(r.seed, k).includes('name');
      const m = GM.modal(`<h3>Where does ${known ? esc(p.name) : 'he'} play?</h3><div class="pos-choice">${byPos.map(i => `<button class="btn" data-slot="${i}"><span class="pos pos-${GM.GROUP[my[i].pos]}">${my[i].pos}</span> ${GM.POS_NAME[my[i].pos]}</button>`).join('')}</div>`);
      GM.$$('[data-slot]', m.el).forEach(b => b.onclick = () => { m.close(); send({ k, slot: +b.dataset.slot }); });
    }
    async function send(move) {
      clearInterval(timer); timer = null;
      GM.$$('[data-pick], #dpass, [data-wild]', root).forEach(b => { b.disabled = true; });
      // work out what happens next on this phone, so the server knows whose turn it is and both summaries stay current
      const next = duelState({ ...r, moves: [...r.moves, { ...move, s: you }] });
      try {
        const res = await rpc('online_move', { ...auth(), p_code: r.code, p_seq: r.moves.length, p_move: move,
          p_sum: duelSum(next, you, r.stat), p_turn: next.done ? 'none' : next.turn });
        if (res !== 'ok' && res !== 'conflict') GM.toast('That pick didn’t go through');
        if (move.w) GM.sound.play('wild'); else if (move.k) { GM.sound.play('place'); GM.buzz(); }
      } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
      GM.online.refresh && GM.online.refresh();
    }
  }
  GM.online.duelState = duelState;  // for tests

  /* ================================================================ "your move" badge + notifications */
  GM.online.setWaiting = n => {
    GM.store.set('onlineWaiting', n);
    GM.$$('.online-badge').forEach(b => { b.textContent = n; b.hidden = !n; });
  };
  // Checks for games waiting on you (a challenge, or your pick). Called from the home screen; toasts new challenges.
  GM.online.check = async function () {
    const a = GM.account();
    if (!a || !GM.lb.enabled) return;
    // the Android app checks every 15 minutes and notifies; the server's app_inbox decides what about (build 12+)
    GM.app('watchGames', a.name, GM.lb.cfg.supabaseUrl, GM.lb.cfg.supabaseAnonKey);
    const lastCheck = GM.online._checked || 0;
    if (Date.now() - lastCheck < 30000) return GM.online._pending;  // a check just ran (or is running): share it
    GM.online._checked = Date.now();
    let list, done;
    GM.online._pending = new Promise(r => { done = r; });
    try { list = await rpc('online_waiting', { p_user: a.name }); } catch (e) { done(); return; }
    setTimeout(done, 0);
    list = list || [];
    GM.online.setWaiting(list.length);
    // one alert per turn: a game counts as new again each time it changes (your next pick, the next lot…)
    const tag = g => g.code + '@' + Math.floor(g.updated || 0);
    const seen = GM.store.get('onlineSeen', []), fresh = list.filter(g => !seen.includes(tag(g)));
    if (fresh.length) {
      const g = fresh[0];
      // a card at the top of the screen; tap it to go straight to the game (or to your games, if there are several)
      const here = location.hash.includes('room=' + g.code) || /^#\/online(\?tab=games)?$/.test(location.hash);  // already looking at it (or at your games list)
      if (!here) GM.notice(fresh.length > 1
        ? { pic: '<span class="notice-icon">🌐</span>', title: `It’s your move in ${fresh.length} online games`, sub: 'Tap to see them', href: '#/online' }
        : { pic: GM.userPic(g.opp || '?'), title: `⚔️ It’s your move against ${esc(g.opp || 'your opponent')}`, sub: `${KIND[gk(g)].icon} ${KIND[gk(g)].name} · tap to play`, href: '#/online?room=' + g.code });
      GM.store.set('onlineSeen', [...seen, ...fresh.map(tag)].slice(-100));
    }
  };
})();
