/* Goal Machine – online head-to-head. Two phones share a room code (Supabase functions create_room / join_room /
   get_room / room_move). Each phone polls the room every ~1.5 s.
   - Live Race: both play Ultimate on the same fair spins at the same time and watch each other's total.
   - Draft Duel: one set of reels, taking turns to pick from it. First pick alternates every spin, and a player your
     rival signs is gone for you. Both phones work out the reels from the room seed and the moves, so only the picks
     travel over the network. */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SEATS = ['host', 'guest'];
  const other = s => (s === 'host' ? 'guest' : 'host');
  const esc = GM.esc;
  const rpc = (f, a) => GM.lb.rpc(f, a);
  const mySeat = code => GM.store.get('online:' + code, null);  // { token, seat }
  let poll = null;
  const stopPoll = () => { clearInterval(poll); poll = null; };
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/online')) stopPoll(); });

  /* ================================================================ lobby */
  GM.onlinePage = function (root, q) {
    stopPoll();
    if (!GM.lb.enabled) { root.innerHTML = top('Play online') + '<p class="muted center">Online games need the leaderboard server, which is switched off.</p>'; return; }
    if (q.room) return room(root, q.room);
    let kind = GM.store.get('onlineKind', 'duel'), stat = GM.store.get('onlineStat', 'goals');
    root.innerHTML = `${top('Play online')}
      <div class="h2h-hero"><div class="h2h-trophy">🌐</div><h3>Play a friend anywhere</h3>
        <p>Start a game and send them the code, or type in the code they sent you.</p></div>
      <div class="setting"><b>Your name</b><input class="input" id="oname" maxlength="20" value="${esc(GM.getName())}" placeholder="e.g. Joel"></div>
      <div class="setting"><b>Game</b>
        <div class="seg" id="okind"><button data-v="duel" class="${kind === 'duel' ? 'on' : ''}">🤝 Draft Duel</button><button data-v="race" class="${kind === 'race' ? 'on' : ''}">🏁 Live Race</button></div>
        <small id="okdesc"></small>
        <div class="seg" id="ostat">${Object.entries(GM.STATS).map(([k, s]) => `<button data-v="${k}" class="${k === stat ? 'on' : ''}">${s.icon} ${s.name}</button>`).join('')}</div>
        <button class="btn big" id="ocreate">➕ Start a game</button></div>
      <div class="setting"><b>Got a code?</b><div class="join-row"><input class="input" id="ocode" maxlength="5" placeholder="ABCDE" value="${esc(q.join || '')}" autocapitalize="characters">
        <button class="btn" id="ojoin">Join</button></div></div>
      <p class="muted center"><a href="#/h2h">📱 Or play on one phone (pass it round)</a></p>`;
    const desc = () => { GM.$('#okdesc').textContent = kind === 'duel'
      ? 'Take turns picking from the same reels. First pick swaps every spin, and whoever you don’t pick is up for grabs.'
      : 'Both build an Ultimate XI on the same spins at the same time. Watch their total climb as you go.'; };
    desc();
    const seg = (id, set) => GM.$$(`#${id} button`).forEach(b => b.onclick = () => { set(b.dataset.v); GM.$$(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); desc(); });
    seg('okind', v => { kind = v; GM.store.set('onlineKind', v); });
    seg('ostat', v => { stat = v; GM.store.set('onlineStat', v); });
    const name = () => { const n = GM.$('#oname').value.trim().slice(0, 20); if (!n) { GM.toast('Pop your name in first'); return null; } GM.store.set('name', GM.account() ? GM.getName() : n); return n; };
    GM.$('#ocreate').onclick = async () => {
      const n = name(); if (!n) return;
      try {
        const r = await rpc('create_room', { p_kind: kind, p_stat: stat, p_name: n });
        GM.store.set('online:' + r.code, { token: r.token, seat: 'host' });
        location.hash = '#/online?room=' + r.code;
      } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
    };
    GM.$('#ojoin').onclick = async () => {
      const n = name(), code = GM.$('#ocode').value.trim().toUpperCase(); if (!n || !code) return;
      try {
        const r = await rpc('join_room', { p_code: code, p_name: n });
        if (r.error) { GM.toast(r.error === 'full' ? 'That game already has two players' : 'No game with that code'); return; }
        GM.store.set('online:' + r.code, { token: r.token, seat: 'guest' });
        location.hash = '#/online?room=' + r.code;
      } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
    };
    if (q.join) GM.$('#ojoin').focus();
  };
  const top = t => `<div class="topbar"><a href="#/" class="back">‹</a><h2>🌐 ${t}</h2><span></span></div>`;

  /* ================================================================ a room */
  async function room(root, code) {
    const me = mySeat(code);
    if (!me) { location.hash = '#/online?join=' + code; return; }
    let last = '';
    const tick = async () => {
      let r;
      try { r = await rpc('get_room', { p_code: code }); } catch (e) { return; }
      if (!r) { stopPoll(); root.innerHTML = top('Play online') + '<p class="muted center">This game has expired.</p>'; return; }
      const sig = JSON.stringify([r.guest, r.moves.length, r.race]);
      if (sig === last) return;
      last = sig;
      if (!r.guest) return waiting(root, r);
      if (r.kind === 'race') return race(root, r, me);
      duel(root, r, me);
    };
    root.innerHTML = top('Play online') + '<p class="muted center">Connecting…</p>';
    await tick();
    stopPoll(); poll = setInterval(tick, 1500);
    GM.online.refresh = tick;
  }
  GM.online = { refresh: null };

  function waiting(root, r) {
    const link = GM.baseUrl() + '#/online?join=' + r.code;
    root.innerHTML = `${top(r.kind === 'duel' ? 'Draft Duel' : 'Live Race')}
      <div class="room-code"><small>Game code</small><b>${r.code}</b><span class="muted">Waiting for your friend to join…</span></div>
      <div class="actions col"><button class="btn big" id="oshare">📤 Send them the code</button></div>
      <p class="muted center">They can tap the link, or open 🌐 Play online and type <b>${r.code}</b>. This screen starts the game as soon as they're in.</p>`;
    GM.$('#oshare').onclick = () => GM.share(`⚽ Goal Machine – ${r.kind === 'duel' ? 'Draft Duel' : 'Live Race'} me! Code ${r.code}`, link);
  }

  /* ================================================================ Live Race */
  function race(root, r, me) {
    const opp = r[other(me.seat)], S = GM.draft.state();
    if (!S || !S.online || S.online.code !== r.code) {
      GM.draft.start(root, 'ultimate', { seed: r.seed, stat: r.stat, online: { code: r.code, token: me.token, seat: me.seat, opp } });
    }
    const theirs = r.race[other(me.seat)] || { t: 0, n: 0 }, mine = r.race[me.seat] || { t: 0, n: 0 };
    const bar = GM.$('#oppbar', root);
    if (bar) bar.innerHTML = `<span>🌐 <b>${esc(opp)}</b>: ${theirs.t.toLocaleString()} ${GM.STATS[r.stat].label} · ${theirs.n}/11${theirs.done ? ' ✓' : ''}</span>`;
    const res = GM.$('#race-result', root);
    if (res && mine.done) {
      res.innerHTML = !theirs.done ? `<div class="banner">⏳ Waiting for ${esc(opp)} to finish (${theirs.n}/11)…</div>`
        : `<div class="banner race-final">${mine.t > theirs.t ? '🏆 You win' : mine.t < theirs.t ? `😬 ${esc(opp)} wins` : '🤝 A draw'} · ${mine.t.toLocaleString()} – ${theirs.t.toLocaleString()}</div>`;
      if (theirs.done && !res.dataset.played) { res.dataset.played = 1; GM.sound.play(mine.t >= theirs.t ? 'fanfare' : 'fulltime'); stopPoll(); }
    }
  }
  // called by the draft engine after every signing and at full time
  GM.online.pushRace = function (S) {
    if (!S.online) return;
    const t = S.xi.reduce((a, s) => a + (s.v ? s.v[S.stat] : 0), 0), n = S.xi.filter(s => s.p != null).length;
    rpc('room_move', { p_code: S.online.code, p_token: S.online.token, p_seq: 0, p_move: { t, n, done: S.phase === 'done' } })
      .then(() => GM.online.refresh && GM.online.refresh()).catch(() => { });
  };

  /* ================================================================ Draft Duel */
  const samplers = {};
  function duelState(r) {
    const st = { xi: { host: FORMATION.map(pos => ({ pos, p: null })), guest: FORMATION.map(pos => ({ pos, p: null })) }, used: new Set(), taken: {}, done: false };
    const open = seat => st.xi[seat].filter(s => s.p == null).map(s => s.pos);
    const fits = (p, poss) => p.poss.some(x => poss.includes(x));
    let i = 0;
    for (let spin = 0; spin < 80; spin++) {
      const order = spin % 2 === 0 ? SEATS : SEATS.slice().reverse();
      const active = order.filter(s => open(s).length);
      if (!active.length) break;
      // the reels: seeded by the room and spin number, first three players who fit anyone's open positions
      const union = [...new Set(active.flatMap(open))], rng = GM.rng(`${r.seed}|duel|${spin}`), reels = [];
      for (let tries = 0; reels.length < 3 && tries < 3000; tries++) {
        const p = GM.players[Math.floor(rng() * GM.players.length)];
        if (!st.used.has(p.id) && !reels.includes(p.id) && fits(p, union)) reels.push(p.id);
      }
      const takenNow = {};
      for (const seat of active) {
        if (i >= r.moves.length) return Object.assign(st, { spin, reels, turn: seat, first: active[0], takenNow, open });
        const m = r.moves[i++];
        if (m.id != null && reels.includes(m.id) && !takenNow[m.id] && st.xi[seat][m.slot] && st.xi[seat][m.slot].p == null) {
          st.xi[seat][m.slot].p = m.id; st.used.add(m.id); takenNow[m.id] = seat; st.taken[m.id] = seat;
        }
      }
    }
    return Object.assign(st, { done: true, open });
  }
  const total = (xi, stat) => xi.reduce((a, s) => a + (s.p != null ? GM.players[s.p][GM.STATS[stat].key] : 0), 0);

  function duel(root, r, me) {
    const st = duelState(r), you = me.seat, them = other(you), names = { [you]: 'You', [them]: r[them] };
    const stat = GM.STATS[r.stat], my = st.xi[you];
    const myOpen = st.open(you);
    const card = id => {
      const p = GM.players[id], by = st.takenNow && st.takenNow[id];
      const fitsMe = p.poss.some(x => myOpen.includes(x));
      const can = !st.done && st.turn === you && !by && fitsMe;
      return `<button class="reel duel-reel ${by ? 'dim taken' : ''} ${!by && !fitsMe ? 'dim' : ''}" data-pick="${id}" ${can ? '' : 'disabled'}>
        ${by ? `<div class="mate">✍️ Signed by ${esc(names[by])}</div>` : !fitsMe ? '<div class="mate nofit">No space in your XI</div>' : ''}
        ${GM.avatar(p, 'lg')}<div class="reel-name">${esc(p.name)}</div>
        <div class="reel-meta">${GM.posBadges(p)} ${GM.flag(p.nat)} ${GM.era(p)}</div>
        <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>
        <div class="reel-goals"><b>?</b> ${stat.label}<small>${p.apps} apps</small></div></button>`;
    };
    const pitch = (xi, mine) => `<div class="duel-xi">${xi.map(s => {
      const p = s.p != null ? GM.players[s.p] : null;
      return `<div class="dx ${p ? 'on' : ''}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span>${p ? `<b>${esc(p.name.split(' ').slice(-1)[0])}</b><i>${p[stat.key]}</i>` : '<b class="muted">–</b>'}</div>`;
    }).join('')}</div>`;
    const tMe = total(my, r.stat), tThem = total(st.xi[them], r.stat), nMe = 11 - myOpen.length, nThem = 11 - st.open(them).length;
    const noFit = !st.done && st.turn === you && !st.reels.some(id => !(st.takenNow || {})[id] && GM.players[id].poss.some(x => myOpen.includes(x)));
    root.innerHTML = `${top('Draft Duel')}
      <div class="h2h-board duel-board">
        <div class="h2h-team p1"><b>You</b><strong>${tMe}</strong><small>${nMe}/11</small></div>
        <div class="h2h-mid"><small>${stat.icon} ${stat.name}</small><span>VS</span><small>Code ${r.code}</small></div>
        <div class="h2h-team p2"><b>${esc(r[them])}</b><strong>${tThem}</strong><small>${nThem}/11</small></div></div>
      ${st.done ? `<div class="banner race-final">${tMe > tThem ? '🏆 You win the duel' : tMe < tThem ? `😬 ${esc(r[them])} wins the duel` : '🤝 A draw'} · ${tMe} – ${tThem}</div>
          <div class="actions col"><button class="btn big" id="dshare">📤 Share the result</button><a class="btn ghost" href="#/online">🌐 New game</a></div>`
        : `<div class="duel-turn ${st.turn === you ? 'mine' : ''}">${st.turn === you ? (st.first === you ? '👉 Your pick – first choice this spin' : '👉 Your pick – from what’s left') : `⏳ ${esc(r[them])} is picking…`}<small>Spin ${st.spin + 1}</small></div>
          <div class="reels">${st.reels.map(card).join('')}</div>
          ${noFit ? '<div class="actions"><button class="btn ghost" id="dpass">None of these fit – pass</button></div>' : ''}`}
      <h3 class="section-title">Your XI</h3>${pitch(my, true)}
      <details class="set"><summary><span>${esc(r[them])}'s XI</span><span>${tThem} ${stat.label}</span></summary>${pitch(st.xi[them], false)}</details>`;
    GM.$$('[data-pick]:not([disabled])', root).forEach(b => b.onclick = () => pick(+b.dataset.pick));
    const ps = GM.$('#dpass', root); if (ps) ps.onclick = () => send({ id: null, slot: null });
    const sh = GM.$('#dshare', root);
    if (sh) sh.onclick = () => GM.share(`⚽ Goal Machine Draft Duel\n${tMe > tThem ? '🏆' : tMe < tThem ? '😬' : '🤝'} Me ${tMe} – ${tThem} ${r[them]} (${stat.label})`, GM.baseUrl() + '#/online');
    if (st.done && !root.dataset.duelDone) { root.dataset.duelDone = r.code; GM.sound.play(tMe >= tThem ? 'fanfare' : 'fulltime'); stopPoll(); }
    if (!st.done && st.turn === you && root.dataset.lastTurn !== `${r.code}:${r.moves.length}`) { root.dataset.lastTurn = `${r.code}:${r.moves.length}`; GM.sound.play('sting'); GM.buzz(30); }

    function pick(id) {
      const p = GM.players[id], slots = my.map((s, k) => k).filter(k => my[k].p == null && p.poss.includes(my[k].pos));
      const slotsByPos = [...new Map(slots.map(k => [my[k].pos, k])).values()];
      if (slotsByPos.length === 1) return send({ id, slot: slotsByPos[0] });
      const m = GM.modal(`<h3>Where does ${esc(p.name)} play?</h3><div class="pos-choice">${slotsByPos.map(k => `<button class="btn" data-slot="${k}"><span class="pos pos-${GM.GROUP[my[k].pos]}">${my[k].pos}</span> ${GM.POS_NAME[my[k].pos]}</button>`).join('')}</div>`);
      GM.$$('[data-slot]', m.el).forEach(b => b.onclick = () => { m.close(); send({ id, slot: +b.dataset.slot }); });
    }
    async function send(move) {
      GM.$$('[data-pick], #dpass', root).forEach(b => { b.disabled = true; });
      try {
        const res = await rpc('room_move', { p_code: r.code, p_token: me.token, p_seq: r.moves.length, p_move: move });
        if (res !== 'ok' && res !== 'conflict') GM.toast('That move didn’t go through');
        if (move.id != null) { GM.sound.play('place'); GM.buzz(); }
      } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
      GM.online.refresh && GM.online.refresh();
    }
  }
  GM.online.duelState = duelState;  // for tests
})();
