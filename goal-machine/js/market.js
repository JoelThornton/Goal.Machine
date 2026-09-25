/* Goal Machine – the transfer market: games with a budget.
   Every player gets a price from his REPUTATION (honours, big clubs, how recently he played, and only partly his real
   output), nudged ±20% by the market's mood in each game. Tallies stay hidden until the end, so the skill is spotting
   who's overpriced and who's a bargain.
   - 💰 Moneyball (solo, and a Daily Moneyball): £200m, four players a round, build the biggest total.
   - 🔄 Transfer Window (solo): three windows. The market reacts to your buys, and each window closes with a report on
     how your signings have done, so you can sell a flop (at a loss) in the next one.
   - 🔨 Auction (pass the phone, or online): £200m each, one player per lot, secret bids, the higher bid signs him.
     Online, the server keeps bids hidden until both are in (online_bid). */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SEATS = ['host', 'guest'];
  const BIG = new Set(['Manchester United', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester City', 'Tottenham Hotspur']);
  const esc = GM.esc, fmt = n => Math.round(n).toLocaleString();
  const money = m => '£' + (Math.round(m * 10) / 10).toLocaleString() + 'm';
  const statSuffix = s => ({ goals: '', assists: 'ast', apps: 'apps' }[s] || '');
  const other = s => (s === 'host' ? 'guest' : 'host');
  const byPk = k => GM.byPk.get(k);

  /* ================================================================ prices */
  function reputation(p) {
    const h = p.hon || {}, big = p.clubs.filter(c => BIG.has(c)).length;
    return 4 + 14 * (h.H || 0) + 5 * (h.W || 0) + 4 * Math.min(3, h.C || 0) + 2.5 * Math.min(6, h.P || 0) + 4 * Math.min(3, h.B || 0)
      + 6 * big + (p.last >= 2018 ? 8 : p.last >= 2010 ? 3 : 0) + 0.9 * Math.sqrt(p.apps * (1 + p.goals / 40));
  }
  // this game's price: reputation with the market's mood (±20%, seeded so both players see the same), to the nearest £0.5m
  const price = (p, seed) => Math.max(1, Math.round(reputation(p) * (0.8 + 0.4 * GM.rng(seed + '|£|' + p.pk)()) * 2) / 2);
  const val = (p, stat) => p[GM.STATS[stat].key];

  /* ================================================================ shared bits */
  const newXi = () => FORMATION.map(pos => ({ pos, k: null, paid: 0 }));
  const openPos = xi => xi.filter(s => !s.k).map(s => s.pos);
  const fits = (p, poss) => p.poss.some(x => poss.includes(x));
  // a random player who fits, isn't taken and passes the filter (seeded)
  function draw(rng, poss, used, ok = () => true) {
    for (let t = 0; t < 8000; t++) {
      const p = GM.players[Math.floor(rng() * GM.players.length)];
      if (!used.has(p.pk) && fits(p, poss) && ok(p)) return p;
    }
    return null;
  }
  // put a signing in the right slot, asking if he could play in two different open positions
  function place(xi, p, done) {
    const slots = xi.map((s, i) => i).filter(i => !xi[i].k && p.poss.includes(xi[i].pos));
    const byPos = [...new Map(slots.map(i => [xi[i].pos, i])).values()];
    if (byPos.length <= 1) return done(byPos[0]);
    const m = GM.modal(`<h3>Where does ${esc(p.name)} play?</h3><div class="pos-choice">${byPos.map(i => `<button class="btn" data-slot="${i}"><span class="pos pos-${GM.GROUP[xi[i].pos]}">${xi[i].pos}</span> ${GM.POS_NAME[xi[i].pos]}</button>`).join('')}</div>`);
    GM.$$('[data-slot]', m.el).forEach(b => b.onclick = () => { m.close(); done(+b.dataset.slot); });
  }
  const autoSlot = (xi, p) => { for (const pos of p.poss) { const i = xi.findIndex(s => !s.k && s.pos === pos); if (i >= 0) return i; } return -1; };
  function card(p, pr, attrs = '', tag = '') {
    const clubs = p.clubs.slice(0, 3).map(c => GM.clubChip(c)).join('') + (p.clubs.length > 3 ? `<small>+${p.clubs.length - 3}</small>` : '');
    return `<button class="duel-card mk-card" ${attrs}>${tag ? `<span class="dc-tag">${tag}</span>` : ''}
      ${GM.avatar(p)}<b>${esc(p.name)}</b><span class="dc-meta">${GM.posBadges(p)}</span><small>${GM.flag(p.nat)} ${GM.era(p)}</small>
      <span class="chips">${clubs}</span><span class="mk-price">${money(pr)}</span></button>`;
  }
  // a squad list: paid price, and the tally once it's out (reveal = true, or a Set of revealed keys)
  function squad(xi, stat, reveal, extra = () => '') {
    const st = GM.STATS[stat];
    return `<div class="mk-squad">${xi.map((s, i) => {
      const p = s.k && byPk(s.k), shown = p && (reveal === true || (reveal && reveal.has && reveal.has(s.k)));
      return `<div class="mk-row ${p ? '' : 'empty'}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span>
        <b>${p ? esc(p.name) : '–'}</b><span class="mk-paid">${p ? money(s.paid) : ''}</span><i>${p ? (shown ? `${fmt(val(p, stat))} ${st.icon}` : '?') : ''}</i>${p ? extra(s, i) : ''}</div>`;
    }).join('')}</div>`;
  }
  function verdicts(xi, stat) {
    const rows = xi.filter(s => s.k).map(s => ({ p: byPk(s.k), paid: s.paid, v: val(byPk(s.k), stat) }));
    const perM = r => r.v / Math.max(0.5, r.paid);
    const best = rows.slice().sort((a, b) => perM(b) - perM(a))[0], worst = rows.slice().sort((a, b) => perM(a) - perM(b) || b.paid - a.paid)[0];
    const lbl = GM.STATS[stat].label;
    return `<div class="verdict good">💎 Bargain: ${esc(best.p.name)} – ${fmt(best.v)} ${lbl} for ${money(best.paid)}</div>
      <div class="verdict bad">💸 Flop: ${esc(worst.p.name)} – ${fmt(worst.v)} ${lbl} for ${money(worst.paid)}</div>`;
  }
  const top = (icon, title, back = '#/') => `<div class="topbar"><a href="${back}" class="back">‹</a><h2>${icon} ${title}</h2><span></span></div>`;
  function statPicker(root, icon, title, blurb, go) {
    root.innerHTML = `${top(icon, title)}<div class="h2h-hero"><div class="h2h-trophy">${icon}</div><h3>${title}</h3><p>${blurb}</p></div>
      <div class="stat-row">${Object.entries(GM.STATS).map(([k, s]) => `<button class="stat-btn" data-s="${k}"><i class="sb-ico">${s.icon}</i>${s.name}</button>`).join('')}</div>`;
    GM.$$('[data-s]', root).forEach(b => b.onclick = () => go(b.dataset.s));
  }
  async function finishSolo(root, { mode, xi, stat, title, icon, lines, again, share }) {
    const total = xi.reduce((a, s) => a + val(byPk(s.k), stat), 0);
    const spent = xi.reduce((a, s) => a + s.paid, 0);
    const { isBest } = await GM.recordScore(mode, total, { t: total });
    GM.sound.play('fulltime');
    if (isBest) setTimeout(() => GM.sound.play('cheer'), 1500);
    const st = GM.STATS[stat];
    root.innerHTML = `${top(icon, title)}
      <div class="result"><div class="result-score">${fmt(total)}<small>PL ${st.label}</small></div>
        <div class="muted">${money(spent)} spent${lines ? ' · ' + lines : ''}</div>
        ${isBest ? '<div class="banner">🏆 New personal best!</div>' : `<div class="muted">Personal best: ${fmt(GM.best(mode))}</div>`}</div>
      ${verdicts(xi, stat)}
      <h3 class="section-title">Your XI</h3>${squad(xi, stat, true)}
      <div class="actions col">${again ? '<button class="btn big" id="mkagain">🔁 Play again</button>' : ''}
        <button class="btn ghost" id="mkshare">📤 Share</button><button class="btn ghost" id="mkpic">🖼️ Share a picture of your XI</button>
        <a class="btn ghost" href="#/leaderboard?m=${encodeURIComponent(mode)}">🏆 Leaderboard</a></div>`;
    const text = `⚽ Goal Machine – ${title}: ${fmt(total)} PL ${st.label} for ${money(spent)}. ${share || 'Can you find better bargains?'}`;
    if (again) GM.$('#mkagain', root).onclick = again;
    GM.$('#mkshare', root).onclick = () => GM.share(text, GM.baseUrl() + '#/' + (mode.startsWith('mbdaily') ? 'moneyball?daily=1' : mode.replace(/(ast|apps)$/, '')));
    GM.$('#mkpic', root).onclick = () => GM.shareImage(GM.teamPicture(xi.map(s => ({ pos: s.pos, p: byPk(s.k), v: val(byPk(s.k), stat) })),
      { title, sub: `${money(spent)} spent`, total, totalLabel: st.label }), text);
    return total;
  }

  /* ================================================================ 💰 Moneyball */
  const MB_BUDGET = 200, MB_RESERVE = 8;
  GM.moneyball = function (root, q = {}) {
    const daily = q.daily === '1', day = GM.today();
    if (daily && GM.store.get('mbd:' + day)) {
      const d = GM.store.get('mbd:' + day);
      root.innerHTML = `${top('💰', 'Daily Moneyball')}<div class="result"><div class="result-score">${fmt(d.total)}<small>PL goals</small></div>
        <div class="muted">Today's done – a new market opens tomorrow (${GM.untilTomorrow ? GM.untilTomorrow() : 'midnight'})</div></div>
        ${verdicts(d.xi, 'goals')}<h3 class="section-title">Your XI</h3>${squad(d.xi, 'goals', true)}
        <div class="actions col"><a class="btn" href="#/leaderboard?m=${encodeURIComponent('mbdaily:' + day)}">🏆 Today's leaderboard</a></div>`;
      return;
    }
    if (!daily && !GM.STATS[q.s]) return statPicker(root, '💰', 'Moneyball', `${money(MB_BUDGET)} to build an XI. Prices come from reputation, not output, and tallies stay hidden until full time. Find the bargains.`, s => { location.hash = '#/moneyball?s=' + s; });
    const stat = daily ? 'goals' : q.s, seed = daily ? 'mb:' + day : GM.newSeed();
    const S = { xi: newXi(), budget: MB_BUDGET, round: 0, used: new Set() };
    const title = daily ? 'Daily Moneyball' : 'Moneyball';
    function offers() {
      const rng = GM.rng(`${seed}|mb|${S.round}`), poss = openPos(S.xi), left = poss.length;
      const cap = S.budget - (left - 1) * MB_RESERVE, out = [];
      const add = p => { if (p && !out.includes(p)) out.push(p); };
      for (let i = 0; i < 3; i++) add(draw(rng, poss, S.used, p => !out.includes(p)));
      // always something you can afford: a cheap one, or if the money's nearly gone, a free agent on whatever's left
      const cheap = draw(rng, poss, S.used, p => !out.includes(p) && price(p, seed) <= cap);
      const list = out.map(p => ({ p, pr: price(p, seed) }));
      if (cheap) list.push({ p: cheap, pr: price(cheap, seed) });
      else { const fa = draw(rng, poss, S.used, p => !out.includes(p)); if (fa) list.push({ p: fa, pr: Math.max(0, Math.floor(cap)), free: true }); }
      return { list, cap };
    }
    function render() {
      const { list, cap } = offers(), left = openPos(S.xi).length;
      root.innerHTML = `${top('💰', title)}
        <div class="mk-budget"><div><small>Budget</small><b>${money(S.budget)}</b></div><div><small>To sign</small><b>${left}</b></div><div><small>Max on one player</small><b>${money(Math.max(0, cap))}</b></div></div>
        <p class="muted center">Keep ${money(MB_RESERVE)} for each empty place after this one. ${GM.STATS[stat].icon} ${GM.STATS[stat].name} stay hidden until full time.</p>
        <div class="duel-cards mk4">${list.map(({ p, pr, free }) => card(p, pr, `data-buy="${esc(p.pk)}" ${pr > cap ? 'disabled' : ''}`, free ? '🆓 Free agent' : pr > cap ? 'Too dear' : '')).join('')}</div>
        <h3 class="section-title">Your XI</h3>${squad(S.xi, stat, false)}`;
      GM.$$('[data-buy]:not([disabled])', root).forEach(b => b.onclick = () => {
        const o = list.find(x => x.p.pk === b.dataset.buy);
        place(S.xi, o.p, i => {
          Object.assign(S.xi[i], { k: o.p.pk, paid: o.pr });
          S.budget = Math.round((S.budget - o.pr) * 10) / 10; S.used.add(o.p.pk); S.round++;
          GM.sound.play('place'); GM.buzz();
          if (openPos(S.xi).length) render(); else end();
        });
      });
    }
    async function end() {
      const mode = daily ? 'mbdaily:' + day : 'moneyball' + statSuffix(stat);
      const total = await finishSolo(root, { mode, xi: S.xi, stat, title, icon: '💰', lines: `${money(S.budget)} left`,
        again: daily ? null : () => GM.moneyball(root, { s: stat }) });
      if (daily) { GM.store.set('mbd:' + day, { total, xi: S.xi }); GM.markDaily('moneyball', total); }
    }
    render();
  };

  /* ================================================================ 🔄 Transfer Window */
  const TW_BUDGET = 180, TW_RESERVE = 6, TW_SELL = 0.75;
  const WINDOWS = [
    { name: '☀️ Summer window', buys: 5, sells: 0, blurb: 'Sign up to five players. Buying pushes up the price of others in that position.' },
    { name: '❄️ January window', buys: 3, sells: 1, blurb: 'The half-season report is in. Sell one flop for 75% of what you paid, and sign up to three.' },
    { name: '📅 Deadline day', buys: 11, sells: 1, blurb: 'Last chance: sell one more if you like, then finish your XI.' },
  ];
  GM.transferWindow = function (root, q = {}) {
    if (!GM.STATS[q.s]) return statPicker(root, '🔄', 'Transfer Window', `${money(TW_BUDGET)} and three transfer windows. The market reacts to your buys, and after each window you find out how your signings have done, so you can sell the flops.`, s => { location.hash = '#/window?s=' + s; });
    const stat = q.s, seed = GM.newSeed();
    const S = { xi: newXi(), budget: TW_BUDGET, w: 0, bought: 0, sold: 0, used: new Set(), seen: new Set(), market: [], history: [] };
    const lbl = GM.STATS[stat].label;
    function openWindow() {
      const rng = GM.rng(`${seed}|tw|${S.w}`), poss = openPos(S.xi), all = FORMATION.slice(), m = [];
      const add = p => { if (p && !m.some(x => x.p === p)) m.push({ p, pr: price(p, seed) }); };
      // mostly players for your gaps, a few for anywhere (in case you sell), and on deadline day a cheap option per gap
      for (let i = 0; i < 9; i++) add(draw(rng, poss.length ? poss : all, S.used, p => !m.some(x => x.p === p)));
      for (let i = 0; i < 3; i++) add(draw(rng, all, S.used, p => !m.some(x => x.p === p)));
      if (S.w === 2) [...new Set(poss)].forEach(pos => add(draw(rng, [pos], S.used, p => !m.some(x => x.p === p) && price(p, seed) <= 12)));
      S.market = m; S.bought = 0; S.sold = 0;
    }
    const W = () => WINDOWS[S.w];
    const cap = () => S.budget - (openPos(S.xi).length - 1) * TW_RESERVE;
    function render() {
      const w = W(), left = openPos(S.xi).length, buysLeft = Math.min(w.buys - S.bought, left), c = cap();
      // deadline day: if nothing affordable fits a gap, a free agent turns up for whatever you can spend
      if (S.w === 2 && left && !S.market.some(x => x.pr <= c && fits(x.p, openPos(S.xi)))) {
        const fa = draw(GM.rng(`${seed}|fa|${left}`), openPos(S.xi), S.used, p => !S.market.some(x => x.p === p));
        if (fa) S.market.push({ p: fa, pr: Math.max(0, Math.floor(c)), free: true });
      }
      const canClose = S.w < 2 || left === 0;
      root.innerHTML = `${top('🔄', 'Transfer Window')}
        <div class="duel-turn mine">${w.name}<small>${w.blurb}</small></div>
        <div class="mk-budget"><div><small>Budget</small><b>${money(S.budget)}</b></div><div><small>Signings left</small><b>${buysLeft}</b></div><div><small>Max on one player</small><b>${money(Math.max(0, c))}</b></div></div>
        <div class="duel-cards mk4">${S.market.map(({ p, pr, free }) => {
          const ok = buysLeft > 0 && pr <= c && fits(p, openPos(S.xi));
          return card(p, pr, `data-buy="${esc(p.pk)}" ${ok ? '' : 'disabled'}`, !fits(p, openPos(S.xi)) ? 'No space' : pr > c ? 'Too dear' : free ? '🆓 Free agent' : '');
        }).join('')}</div>
        <h3 class="section-title">Your squad</h3>
        ${squad(S.xi, stat, S.seen, s => (w.sells > S.sold && S.seen.has(s.k) ? `<button class="btn ghost small" data-sell="${esc(s.k)}">Sell ${money(Math.round(s.paid * TW_SELL * 2) / 2)}</button>` : ''))}
        ${S.history.length ? `<details class="set"><summary><span>📰 Transfer news</span><span>${S.history.length}</span></summary><div class="mk-news">${S.history.map(h => `<div>${h}</div>`).join('')}</div></details>` : ''}
        <div class="actions col"><button class="btn big" id="twclose" ${canClose ? '' : 'disabled'}>${S.w < 2 ? '🔒 Close the window' : left ? `Sign ${left} more to finish` : '🏁 Full time'}</button></div>`;
      GM.$$('[data-buy]:not([disabled])', root).forEach(b => b.onclick = () => buy(b.dataset.buy));
      GM.$$('[data-sell]', root).forEach(b => b.onclick = () => sell(b.dataset.sell));
      GM.$('#twclose', root).onclick = closeWindow;
    }
    function buy(k) {
      const o = S.market.find(x => x.p.pk === k);
      place(S.xi, o.p, i => {
        Object.assign(S.xi[i], { k, paid: o.pr });
        S.budget = Math.round((S.budget - o.pr) * 10) / 10; S.used.add(k); S.bought++;
        S.market = S.market.filter(x => x !== o);
        // the market reacts: others who play that position get 10% dearer
        const g = GM.GROUP[S.xi[i].pos];
        let n = 0;
        S.market.forEach(x => { if (x.p.poss.some(pp => GM.GROUP[pp] === g)) { x.pr = Math.round(x.pr * 1.1 * 2) / 2; n++; } });
        S.history.unshift(`✍️ Signed ${esc(o.p.name)} for ${money(o.pr)}${n ? ` – ${GM.POS_NAME[g] || g} prices up 10%` : ''}`);
        GM.sound.play('place'); GM.buzz();
        render();
      });
    }
    function sell(k) {
      const s = S.xi.find(x => x.k === k), p = byPk(k), back = Math.round(s.paid * TW_SELL * 2) / 2;
      GM.confirm(`Sell ${esc(p.name)} (${fmt(val(p, stat))} ${lbl}) for ${money(back)}?`, 'Sell', 'Keep').then(ok => {
        if (!ok) return;
        S.budget = Math.round((S.budget + back) * 10) / 10; S.sold++;
        S.history.unshift(`👋 Sold ${esc(p.name)} for ${money(back)}`);
        s.k = null; s.paid = 0;
        GM.sound.play('swoosh'); render();
      });
    }
    function closeWindow() {
      if (S.w === 2) return finishSolo(root, { mode: 'window' + statSuffix(stat), xi: S.xi, stat, title: 'Transfer Window', icon: '🔄', lines: `${money(S.budget)} left`, again: () => GM.transferWindow(root, { s: stat }) });
      // the report on how your signings have done
      const fresh = S.xi.filter(s => s.k && !S.seen.has(s.k));
      fresh.forEach(s => S.seen.add(s.k));
      const m = GM.modal(`<h3>📋 ${S.w === 0 ? 'Half-season' : 'End of season'} report</h3>
        ${fresh.length ? `<p class="muted">Here's what your new signings are worth:</p>${fresh.map(s => { const p = byPk(s.k); return `<div class="mk-row"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span><b>${esc(p.name)}</b><span class="mk-paid">${money(s.paid)}</span><i>${fmt(val(p, stat))} ${GM.STATS[stat].icon}</i></div>`; }).join('')}`
          : '<p class="muted">No new signings this window.</p>'}
        <div class="row"><button class="btn" data-close>On to the ${S.w === 0 ? 'January window' : 'deadline'} ➜</button></div>`, { onClose: () => { S.w++; openWindow(); render(); } });
      GM.sound.play('whistle');
      return m;
    }
    openWindow(); render();
  };

  /* ================================================================ 🔨 Auction (the engine both versions share) */
  const AU_BUDGET = 200;
  // Replays an auction from its sold lots. Each lot's player is seeded by the game and lot number and fits someone's gap;
  // whoever has a gap he fits can bid (need = 'both', 'host' or 'guest'); the higher bid signs him, a tie is a coin toss.
  function auctionState(seed, moves) {
    const st = { xi: { host: newXi(), guest: newXi() }, money: { host: AU_BUDGET, guest: AU_BUDGET }, used: new Set(), history: [], done: false };
    const open = seat => openPos(st.xi[seat]);
    for (let lot = 0; lot < 200; lot++) {
      const seats = SEATS.filter(s => open(s).length);
      if (!seats.length) { st.done = true; break; }
      const rng = GM.rng(`${seed}|lot|${lot}`), p = draw(rng, [...new Set(seats.flatMap(open))], st.used);
      if (!p) { st.done = true; break; }
      const eligible = seats.filter(s => fits(p, open(s))), need = eligible.length === 2 ? 'both' : eligible[0];
      const maxBid = s => Math.max(0, Math.floor(st.money[s] - (open(s).length - 1)));
      const m = moves[lot];
      if (!m) return Object.assign(st, { lot, current: { p, guide: price(p, seed), need, eligible }, maxBid, open });
      const bids = {};
      eligible.forEach(s => { bids[s] = Math.min(maxBid(s), Math.max(0, Math.floor(+((m.bids || {})[s]) || 0))); });
      const winner = eligible.length === 1 ? eligible[0] : bids.host > bids.guest ? 'host' : bids.guest > bids.host ? 'guest' : (rng() < 0.5 ? 'host' : 'guest');
      const i = autoSlot(st.xi[winner], p);
      st.xi[winner][i].k = p.pk; st.xi[winner][i].paid = bids[winner];
      st.money[winner] = Math.round((st.money[winner] - bids[winner]) * 10) / 10;
      st.used.add(p.pk);
      st.history.push({ lot, p, winner, bids, tie: eligible.length === 2 && bids.host === bids.guest });
    }
    return Object.assign(st, { done: true, open, maxBid: () => 0 });
  }
  const auctionSums = (st, stat) => Object.fromEntries(SEATS.map(s => {
    const xi = st.xi[s].filter(x => x.k).map(x => ({ pos: x.pos, player: byPk(x.k) }));
    return [s, { t: xi.reduce((a, x) => a + val(x.player, stat), 0), r: xi.length ? GM.teamRating(xi).score : 0, n: xi.length, done: xi.length === 11 }];
  }));
  GM.market = { reputation, price, money, auctionState, auctionSums };

  function lotHtml(st, stat, names, you) {
    const c = st.current, p = c.p;
    return `<div class="mk-lot">${GM.avatar(p, 'lg')}<div><small>Lot ${st.lot + 1}</small><b>${esc(p.name)}</b>
        <span class="dc-meta">${GM.posBadges(p)} ${GM.flag(p.nat)} ${GM.era(p)}</span><span class="chips">${p.clubs.map(x => GM.clubChip(x)).join('')}</span>
        <span class="mk-guide">Guide price ${money(c.guide)}</span></div></div>
      ${c.need !== 'both' ? `<p class="muted center">Only ${esc(names[c.need])} has a place for him${you && c.need !== you ? '' : ' – any bid wins, even £0m'}.</p>` : ''}`;
  }
  function lastSale(st, names) {
    const h = st.history[st.history.length - 1];
    if (!h) return '';
    const b = SEATS.filter(s => h.bids[s] != null).map(s => `${esc(names[s])} ${money(h.bids[s])}`).join(' · ');
    return `<div class="banner mk-sold">🔨 <b>${esc(h.p.name)}</b> to ${esc(names[h.winner])} for ${money(h.bids[h.winner])}${h.tie ? ' (tie – coin toss)' : ''}<small>${b}</small></div>`;
  }
  function bidForm(max, guide) {
    const start = Math.min(max, Math.round(guide));
    return `<div class="mk-bid"><div class="mk-bid-amt">£<input type="number" id="bidv" min="0" max="${max}" step="1" value="${start}" inputmode="numeric">m</div>
      <input type="range" id="bidr" min="0" max="${max}" step="1" value="${start}"><small class="muted">Up to ${money(max)} (keep £1m per empty place)</small></div>`;
  }
  function wireBid(root) {
    const v = GM.$('#bidv', root), r = GM.$('#bidr', root);
    r.oninput = () => { v.value = r.value; };
    v.oninput = () => { r.value = v.value; };
    return () => Math.max(0, Math.min(+r.max, Math.floor(+v.value || 0)));
  }
  const teams = (st, stat, names) => `<div class="cmp"><div><h4>${esc(names.host)} · ${money(st.money.host)}</h4>${squad(st.xi.host, stat, false)}</div>
    <div><h4>${esc(names.guest)} · ${money(st.money.guest)}</h4>${squad(st.xi.guest, stat, false)}</div></div>`;

  /* ---------------------------------------------------------------- pass the phone */
  GM.auction = function (root, q = {}) {
    let A = GM.store.get('auction:local');
    if (q.new || !A) {
      const n = GM.store.get('h2hNames', ['Player 1', 'Player 2']);
      root.innerHTML = `${top('🔨', 'Auction')}
        <div class="h2h-hero"><div class="h2h-trophy">🔨</div><h3>The transfer auction</h3><p>${money(AU_BUDGET)} each. One player per lot, secret bids, and the higher bid signs him. Tallies stay hidden until full time.</p></div>
        <div class="setting"><b>Players</b><div class="join-row names"><input class="input" id="an1" maxlength="14" value="${esc(n[0])}"><input class="input" id="an2" maxlength="14" value="${esc(n[1])}"></div></div>
        <div class="stat-row">${Object.entries(GM.STATS).map(([k, s]) => `<button class="stat-btn" data-s="${k}"><i class="sb-ico">${s.icon}</i>${s.name}</button>`).join('')}</div>
        <p class="muted center"><a href="#/online">🌐 Or auction against a friend online</a></p>`;
      GM.$$('[data-s]', root).forEach(b => b.onclick = () => {
        const names = [GM.$('#an1').value.trim() || 'Player 1', GM.$('#an2').value.trim() || 'Player 2'];
        GM.store.set('h2hNames', names);
        GM.store.set('auction:local', { seed: GM.newSeed(), stat: b.dataset.s, names: { host: names[0], guest: names[1] }, moves: [], pending: {} });
        location.hash = '#/auction';
        if (location.hash === '#/auction') GM.auction(root);
      });
      return;
    }
    const save = () => GM.store.set('auction:local', A);
    const st = auctionState(A.seed, A.moves), names = A.names;
    if (st.done) return auctionEnd(root, st, A);
    const who = st.current.need === 'both' ? SEATS.find(s => A.pending[s] == null) : st.current.need;
    // cover screen between players so nobody sees the other's bid
    root.innerHTML = `${top('🔨', 'Auction')}
      ${lastSale(st, names)}
      <div class="mk-cover"><div class="h2h-trophy">🙈</div><h3>Pass the phone to ${esc(names[who])}</h3>
        <p class="muted">${st.current.need === 'both' && A.pending[other(who)] != null ? `${esc(names[other(who)])} has bid. ` : ''}No peeking!</p>
        <button class="btn big" id="aready">I'm ${esc(names[who])} – show me the lot</button></div>
      ${teams(st, A.stat, names)}
      <div class="actions"><button class="btn ghost small" id="aquit">🏳️ Abandon auction</button></div>`;
    GM.$('#aquit', root).onclick = () => GM.confirm('Abandon this auction?').then(ok => { if (ok) { GM.store.set('auction:local', null); location.hash = '#/auction?new=1'; } });
    GM.$('#aready', root).onclick = () => {
      root.innerHTML = `${top('🔨', 'Auction')}<div class="duel-turn mine">${esc(names[who])}'s secret bid<small>${money(st.money[who])} left · ${st.open(who).length} to sign</small></div>
        ${lotHtml(st, A.stat, names, who)}${bidForm(st.maxBid(who), st.current.guide)}
        <div class="actions col"><button class="btn big" id="abid">🔨 Lock in my bid</button></div>`;
      const read = wireBid(root);
      GM.$('#abid', root).onclick = () => {
        A.pending[who] = read();
        const needed = st.current.need === 'both' ? SEATS : [st.current.need];
        if (needed.every(s => A.pending[s] != null)) {
          A.moves.push({ lot: st.lot, bids: Object.fromEntries(needed.map(s => [s, A.pending[s]])) });
          A.pending = {};
          GM.sound.play('horn');
        } else GM.sound.play('place');
        save(); GM.auction(root);
      };
    };
  };
  function auctionEnd(root, st, A) {
    const sums = auctionSums(st, A.stat), names = A.names, statI = GM.STATS[A.stat];
    const pts = { host: 0, guest: 0 };
    const award = (a, b, w) => { if (a > b) pts.host += w; else if (b > a) pts.guest += w; else { pts.host += w / 2; pts.guest += w / 2; } };
    award(sums.host.t, sums.guest.t, 60); award(sums.host.r, sums.guest.r, 40);
    const win = pts.host > pts.guest ? 'host' : pts.guest > pts.host ? 'guest' : null;
    root.innerHTML = `${top('🔨', 'Auction')}
      <div class="h2h-board duel-board"><div class="h2h-team p1"><b>${esc(names.host)}</b><strong>${pts.host}</strong><small>points</small></div>
        <div class="h2h-mid"><small>${statI.icon} ${statI.name}</small><span>VS</span></div>
        <div class="h2h-team p2"><b>${esc(names.guest)}</b><strong>${pts.guest}</strong><small>points</small></div></div>
      <div class="banner race-final">${win ? `🏆 ${esc(names[win])} wins the auction` : '🤝 A draw'}</div>
      <table class="cmp-points"><tr><th></th><th>${esc(names.host)}</th><th>${esc(names.guest)}</th><th>Pts</th></tr>
        <tr><td>${statI.icon} Bigger total</td><td class="${sums.host.t > sums.guest.t ? 'won' : ''}">${fmt(sums.host.t)}</td><td class="${sums.guest.t > sums.host.t ? 'won' : ''}">${fmt(sums.guest.t)}</td><td>60</td></tr>
        <tr><td>⭐ Better squad rating</td><td class="${sums.host.r > sums.guest.r ? 'won' : ''}">${sums.host.r}</td><td class="${sums.guest.r > sums.host.r ? 'won' : ''}">${sums.guest.r}</td><td>40</td></tr></table>
      <div class="cmp"><div><h4>${esc(names.host)}</h4>${squad(st.xi.host, A.stat, true)}</div><div><h4>${esc(names.guest)}</h4>${squad(st.xi.guest, A.stat, true)}</div></div>
      <div class="actions col"><a class="btn big" href="#/auction?new=1">🔁 New auction</a></div>`;
    GM.sound.play('fanfare');
    GM.store.set('auction:local', null);
  }

  /* ---------------------------------------------------------------- online (called by online.js) */
  GM.market.auctionOnline = function (root, r, you, api) {
    const st = auctionState(r.seed, r.moves), them = other(you), names = { [you]: 'You', [them]: r[them] || '…' };
    const sums = auctionSums(st, r.stat);
    const need = st.done ? 'none' : st.current.need;
    // keep the server's idea of whose bid it is (for notifications) and both XI summaries in step with the moves
    const synced = r.turn === (need === 'none' ? null : need) && JSON.stringify(SEATS.map(s => (r.race[s] || {}).n || 0)) === JSON.stringify(SEATS.map(s => sums[s].n));
    if (!synced && r.guest) api.rpc('online_move', { ...api.auth(), p_code: r.code, p_seq: 0, p_move: null, p_sum: null, p_turn: need, p_all: sums })
      .then(() => api.refresh()).catch(() => { });
    if (st.done || r.status === 'done' || r.status === 'declined') return api.summary(root, r, you);
    const mine = st.current.need === 'both' || st.current.need === you, bidIn = (r.bids_in || []).includes(you), theirsIn = (r.bids_in || []).includes(them);
    const turnText = !mine ? `⏳ Only ${esc(r[them])} can bid on this one` : bidIn ? `⏳ Bid locked in – waiting for ${esc(r[them] || 'your opponent')}` : `👉 Your secret bid${theirsIn ? ` – ${esc(r[them])} has bid` : ''}`;
    // same lot and you're still deciding: just update the status line, so a bid you're typing isn't wiped
    const lotKey = `${r.code}:${st.lot}:${bidIn}:${r.guest || ''}`;
    if (root.dataset.lotKey === lotKey && GM.$('#abid', root)) { const t = GM.$('.duel-turn b', root); if (t) t.innerHTML = turnText; return; }
    root.dataset.lotKey = lotKey;
    const soldKey = `${r.code}:${r.moves.length}`;
    if (r.moves.length && root.dataset.sold !== soldKey) { root.dataset.sold = soldKey; GM.sound.play('horn'); }
    root.innerHTML = `${api.top('Auction', '#/online')}
      ${api.inviteBar(r)}
      ${lastSale(st, names)}
      <div class="duel-turn ${mine && !bidIn ? 'mine' : ''}"><b>${turnText}</b>
        <small>${money(st.money[you])} left · ${st.open(you).length} to sign · ${esc(r[them] || '…')}: ${money(st.money[them])}</small></div>
      ${lotHtml(st, r.stat, names, you)}
      ${mine && !bidIn ? `${bidForm(st.maxBid(you), st.current.guide)}<div class="actions col"><button class="btn big" id="abid">🔨 Lock in my bid</button></div>` : ''}
      ${teams(st, r.stat, names)}
      <div class="actions"><button class="btn ghost small" id="oresign">🏳️ ${r.guest ? 'Resign' : 'Cancel invite'}</button></div>`;
    api.wireInvite(root, r);
    api.resignButton(root, r, you);
    const b = GM.$('#abid', root);
    if (b) {
      const read = wireBid(root);
      b.onclick = async () => {
        b.disabled = true;
        try {
          const res = await api.rpc('online_bid', { ...api.auth(), p_code: r.code, p_lot: st.lot, p_bid: read(), p_need: st.current.need });
          GM.sound.play(res === 'sold' ? 'horn' : 'place');
          if (res !== 'sold' && res !== 'waiting') GM.toast(res === 'stale' ? 'That lot has already sold' : 'That bid didn’t go through');
        } catch (e) { GM.toast('Couldn’t reach the server – try again'); }
        api.refresh();
      };
    }
  };
})();
