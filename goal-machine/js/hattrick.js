/* Goal Machine – 🃏 Hat-Trick: football Spades (beta)
   Four players in two teams: you and a computer partner against two computer rivals. A fresh deck of 52 real PL
   players: four suits of 13 (🛡️ Defenders, ⚙️ Midfielders, ⚽ Forwards and ⭐ Legends, the trumps). A card's
   strength is the player's PL goals, assists or appearances (each game picks one). Normal shows the numbers, like
   pure Spades; Hard hides them until a card is played, so knowing your players is the edge.
   Bid the tricks you'll win (0 = Nil), follow suit, Legends trump and can't be led until one has been played.
   A team that makes its bid scores 10 a trick bid, +1 per extra trick (a 🟨; ten 🟨 cost 100); a missed bid loses
   10 a trick bid. Nil: +100 made, −100 missed. First team to 250 wins. */
'use strict';

(function () {
  const SUITS = { L: { icon: '⭐', name: 'Legends' }, F: { icon: '⚽', name: 'Forwards' }, M: { icon: '⚙️', name: 'Midfielders' }, D: { icon: '🛡️', name: 'Defenders' } };
  const SUIT_ORDER = ['L', 'F', 'M', 'D'];
  const STAT = { goals: 'goals', assists: 'ast', apps: 'apps' };
  const SEATS = [{ name: 'You', icon: '🙂' }, { name: 'Gaffer', icon: '🧢' }, { name: 'Skipper', icon: '🤝' }, { name: 'Pundit', icon: '🎩' }];
  const TARGET = 250, FLOOR = -200, SAVE = 'ht:save';
  const team = s => s % 2;                   // team 0: you (0) + partner (2); team 1: the rivals (1, 3)
  const partner = s => (s + 2) % 4;
  const fmt = n => n.toLocaleString();
  let G = null, root = null, busy = false, picked = null;

  /* ---------------------------------------------------------------- the deck */
  // 13 players a suit, picked by fame (so you know most of them), with no two alike in the game's stat
  function deal(seed, stat) {
    const r = GM.rng(seed + '|deal'), key = STAT[stat], used = new Set(), cards = [];
    const legend = p => p.hon.H || p.hon.B || p.goals >= 100;
    const pools = {
      L: GM.players.filter(legend),
      F: GM.players.filter(p => !legend(p) && GM.GROUP[p.poss[0]] === 'F'),
      M: GM.players.filter(p => !legend(p) && GM.GROUP[p.poss[0]] === 'M'),
      D: GM.players.filter(p => !legend(p) && ['D', 'G'].includes(GM.GROUP[p.poss[0]])),
    };
    SUIT_ORDER.forEach(s => {
      const vals = new Set(), got = [];
      let pool = pools[s].slice();
      while (got.length < 13 && pool.length) {
        const p = r.weighted(pool, x => Math.sqrt(x.fame));
        pool = pool.filter(x => x !== p);
        if (used.has(p.pk) || vals.has(p[key])) continue;
        used.add(p.pk); vals.add(p[key]); got.push(p);
      }
      got.sort((a, b) => a[key] - b[key]).forEach((p, i) => cards.push({ id: s + i, s, pk: p.pk, v: p[key], rank: i + 1 }));
    });
    const sh = r.shuffle(cards);
    return [0, 1, 2, 3].map(i => sh.slice(i * 13, i * 13 + 13));
  }
  const player = c => GM.byPk.get(c.pk);
  const surname = c => { const n = player(c).name; return n.includes(' ') ? n.split(' ').slice(1).join(' ') : n; };
  // your hand: by suit, then strongest first (Hard: A–Z, as the order would give the numbers away)
  const sortHand = h => h.sort((a, b) => SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s) || (G.hard ? surname(a).localeCompare(surname(b)) : b.rank - a.rank));

  /* ---------------------------------------------------------------- a new game / hand */
  function newGame(hard) {
    const seed = GM.newSeed(), stat = ['goals', 'assists', 'apps'][GM.rng(seed + '|stat').int(3)];
    G = { seed, stat, hard, scores: [0, 0], bags: [0, 0], handNo: 0, dealer: 3, history: [], over: false };
    newHand();
  }
  function newHand() {
    G.handNo++;
    G.dealer = (G.dealer + 1) % 4;
    G.hands = deal(G.seed + '|' + G.handNo, G.stat);
    sortHand(G.hands[0]);
    G.bids = [null, null, null, null]; G.won = [0, 0, 0, 0];
    G.phase = 'bid'; G.turn = (G.dealer + 1) % 4;
    G.trick = []; G.broken = false; G.played = []; G.last = null;
  }
  const save = () => GM.store.set(SAVE, G.over ? null : G);

  /* ---------------------------------------------------------------- rules */
  function legal(seat) {
    const h = G.hands[seat];
    if (!G.trick.length) {
      const side = h.filter(c => c.s !== 'L');
      return G.broken || !side.length ? h : side;
    }
    const led = G.trick[0].c.s, follow = h.filter(c => c.s === led);
    return follow.length ? follow : h;
  }
  // the card winning the trick so far: the best Legend, else the best of the suit led
  const winning = (trick = G.trick) => trick.slice(1).reduce((w, t) => (beats(t.c, w.c) ? t : w), trick[0]);
  const beats = (b, a) => (b.s === 'L' && a.s !== 'L') || (b.s === a.s && b.rank > a.rank);

  /* ---------------------------------------------------------------- the computer managers */
  // what's still out there that this seat can't see
  const unseen = seat => {
    const mine = new Set(G.hands[seat].map(c => c.id)), gone = new Set(G.played.map(c => c.id));
    return G.hands.flat().concat(G.trick.map(t => t.c)).filter(c => !mine.has(c.id) && !gone.has(c.id) && !G.trick.some(t => t.c.id === c.id));
  };
  const isBoss = (seat, c) => !unseen(seat).some(x => x.s === c.s && x.rank > c.rank);
  function cpuBid(seat) {
    const h = G.hands[seat], by = s => h.filter(c => c.s === s), trumps = by('L');
    let est = 0;
    trumps.forEach(c => { est += c.rank >= 12 ? 1 : c.rank >= 10 ? 0.7 : c.rank >= 8 ? 0.35 : 0.1; });
    est += Math.max(0, trumps.length - 3) * 0.6;
    ['F', 'M', 'D'].forEach(s => {
      const suit = by(s), n = suit.length;
      suit.forEach(c => { est += c.rank === 13 ? (n <= 5 ? 0.95 : 0.7) : c.rank === 12 ? (n >= 2 && n <= 4 ? 0.6 : 0.3) : c.rank === 11 && n >= 3 && n <= 4 ? 0.25 : 0; });
      if (n <= 1 && trumps.length >= 2) est += n === 0 ? 0.6 : 0.3;  // short suits let the trumps in
    });
    let bid = Math.max(1, Math.round(est + (seat !== 0 && G.level === 'easy' ? (Math.random() * 2 - 1) : 0)));
    const p = G.bids[partner(seat)];
    if (p != null && p + bid > 10) bid = Math.max(1, 10 - p);
    return Math.min(bid, 7);
  }
  function cpuPlay(seat) {
    const opts = legal(seat);
    // Easy managers often just play something; Medium now and then plays the lowest card when it shouldn't
    if (G.level === 'easy' && Math.random() < 0.4) return opts[Math.floor(Math.random() * opts.length)];
    if (G.level === 'medium' && Math.random() < 0.12) return opts.slice().sort((x, y) => x.rank - y.rank)[0];
    return bestPlay(seat, opts);
  }
  function bestPlay(seat, opts) {
    const low = a => a.slice().sort((x, y) => x.rank - y.rank)[0], high = a => a.slice().sort((x, y) => y.rank - x.rank)[0];
    const t = team(seat), teamBid = [t, t + 2].reduce((a, s) => a + (G.bids[s] || 0), 0), teamWon = G.won[t] + G.won[t + 2];
    const need = teamWon < teamBid;
    if (!G.trick.length) {  // leading
      const side = opts.filter(c => c.s !== 'L');
      if (need) { const boss = opts.filter(c => isBoss(seat, c)); if (boss.length) return high(boss); }
      const pool = side.length ? side : opts;
      const counts = s => G.hands[seat].filter(c => c.s === s).length;
      const longest = pool.slice().sort((a, b) => counts(b.s) - counts(a.s))[0].s;
      return low(pool.filter(c => c.s === longest));
    }
    const led = G.trick[0].c.s, w = winning(), last = G.trick.length === 3;
    const partnerWinning = w.seat === partner(seat) && (last || isBoss(seat, w.c) || w.c.s === 'L');
    const winners = opts.filter(c => beats(c, w.c));
    if (opts[0].s === led) {  // following suit
      if (partnerWinning || !need || !winners.length) return low(opts);
      if (last) return low(winners);
      const top = high(winners); return isBoss(seat, top) ? top : low(opts);
    }
    // can't follow: trump if it matters, otherwise throw the lowest side card (shortest suit first)
    const side = opts.filter(c => c.s !== 'L'), trumps = winners.filter(c => c.s === 'L');
    if (!partnerWinning && need && trumps.length) return low(trumps);
    if (side.length) {
      const counts = s => G.hands[seat].filter(c => c.s === s).length;
      return side.slice().sort((a, b) => counts(a.s) - counts(b.s) || a.rank - b.rank)[0];
    }
    return low(opts);
  }

  /* ---------------------------------------------------------------- playing it out */
  function play(seat, card) {
    G.hands[seat] = G.hands[seat].filter(c => c.id !== card.id);
    if (card.s === 'L') G.broken = true;
    G.trick.push({ seat, c: card });
    GM.sound.play('card');
    if (G.trick.length < 4) { G.turn = (seat + 1) % 4; save(); return render(); }
    // trick done: show it, then the winner takes it and leads the next
    const w = winning();
    G.won[w.seat]++;
    G.last = { trick: G.trick.slice(), winner: w.seat };
    setTimeout(() => GM.sound.play(team(w.seat) === 0 ? 'trickwin' : 'tricklose'), 250);
    G.turn = w.seat;
    render();
    busy = true;
    setTimeout(() => {
      busy = false;
      G.played.push(...G.trick.map(t => t.c));
      G.trick = [];
      if (G.played.length === 52) return endHand();
      save(); render();
    }, 1300);
  }
  function endHand() {
    const lines = [];
    [0, 1].forEach(t => {
      const seats = [t, t + 2];
      let pts = 0, bags = 0;
      const nilSeats = seats.filter(s => G.bids[s] === 0), bidSeats = seats.filter(s => G.bids[s] > 0);
      nilSeats.forEach(s => { pts += G.won[s] === 0 ? 100 : -100; bags += G.won[s]; });
      const bid = bidSeats.reduce((a, s) => a + G.bids[s], 0), won = bidSeats.reduce((a, s) => a + G.won[s], 0);
      if (bid) { if (won >= bid) { pts += 10 * bid; bags += won - bid; } else pts -= 10 * bid; }
      pts += bags;
      G.bags[t] += bags;
      let red = 0;
      while (G.bags[t] >= 10) { G.bags[t] -= 10; pts -= 100; red++; }
      G.scores[t] += pts;
      lines.push({ t, bid, won: seats.reduce((a, s) => a + G.won[s], 0), nil: nilSeats.map(s => ({ s, ok: G.won[s] === 0 })), pts, bags, red });
    });
    G.history.push({ hand: G.handNo, lines });
    const [a, b] = G.scores;
    G.over = (a >= TARGET || b >= TARGET || a <= FLOOR || b <= FLOOR) && a !== b;
    G.phase = 'handover';
    save(); render();
    handSummary(lines);
  }

  /* ---------------------------------------------------------------- the computer's turns */
  function tick() {
    if (!G || busy || G.over || !root || !root.isConnected || !location.hash.startsWith('#/hattrick') || !GM.$('.ht-table', root)) return;
    if (G.phase === 'bid' && G.turn !== 0) {
      busy = true;
      setTimeout(() => {
        busy = false;
        if (!G || G.phase !== 'bid' || G.turn === 0) return;
        G.bids[G.turn] = cpuBid(G.turn);
        GM.sound.play('tick');
        nextBidder();
      }, 700);
    } else if (G.phase === 'play' && G.turn !== 0 && G.trick.length < 4) {
      busy = true;
      setTimeout(() => { busy = false; if (G && G.phase === 'play' && G.turn !== 0 && G.trick.length < 4) play(G.turn, cpuPlay(G.turn)); }, 750);
    }
  }
  function nextBidder() {
    if (G.bids.every(b => b != null)) { G.phase = 'play'; G.turn = (G.dealer + 1) % 4; }
    else G.turn = (G.turn + 1) % 4;
    save(); render();
  }

  /* ---------------------------------------------------------------- drawing */
  const numShown = c => !G.hard || G.played.some(x => x.id === c.id) || G.trick.some(t => t.c.id === c.id);
  const cardHtml = (c, cls = '', style = '') => `<button class="ht-card suit-${c.s} ${cls}" data-card="${c.id}" ${style ? `style="${style}"` : ''} title="${GM.esc(player(c).name)}">
      <span class="ht-corner"><b>${numShown(c) ? fmt(c.v) : '?'}</b><i>${SUITS[c.s].icon}</i></span><span class="ht-name">${GM.esc(surname(c))}</span></button>`;
  const statLabel = () => `${GM.STATS[G.stat].icon} ${GM.STATS[G.stat].name}`;
  const teamBid = t => [t, t + 2].reduce((a, s) => a + (G.bids[s] || 0), 0);
  const teamWon = t => G.won[t] + G.won[t + 2];
  const pill = (s, pos) => `<div class="ht-pill ht-${pos} t${team(s)} ${G.turn === s && G.phase !== 'handover' && !G.over && G.trick.length < 4 ? 'turn' : ''}">
      ${G.bids[s] != null ? `<span class="ht-badge">${G.phase === 'bid' ? `Bid ${G.bids[s] === 0 ? 'nil' : G.bids[s]}` : `${G.won[s]}/${G.bids[s] === 0 ? 'nil' : G.bids[s]}`}</span>` : ''}<b>${SEATS[s].name}</b></div>`;
  function trickHtml() {
    const w = G.trick.length === 4 ? winning() : null;
    const at = s => { const t = G.trick.find(x => x.seat === s); return t ? cardHtml(t.c, `played ${w && w.seat === s ? 'win' : ''}`) : ''; };
    return `<div class="ht-trick"><div class="ht-t2">${at(2)}</div><div class="ht-t1">${at(1)}</div><div class="ht-t3">${at(3)}</div><div class="ht-t0">${at(0)}</div></div>`;
  }
  function render() {
    if (!root || !root.isConnected) return;
    if (!G) return intro();
    const mode = G.hard ? 'hattrickh' : 'hattrick';
    const canPlay = G.phase === 'play' && G.turn === 0 && G.trick.length < 4 && !busy;
    const ok = canPlay ? new Set(legal(0).map(c => c.id)) : new Set();
    const n = G.hands[0].length;
    const w = G.trick.length === 4 ? winning() : null;
    const tip = w ? `<b class="t${team(w.seat)}">${w.seat === 0 ? 'You win the trick' : `${SEATS[w.seat].name} wins the trick`}</b>`
      : G.phase === 'bid' ? (G.turn === 0 ? '' : `${SEATS[G.turn].name} is bidding…`)
      : canPlay ? (picked ? 'Tap it again to play it' : G.trick.length ? 'Your turn: follow the suit if you can' : `Your lead${G.broken ? '' : ' (⭐ Legends not broken yet)'}`)
      : G.phase === 'play' ? `${SEATS[G.turn].name} is thinking…` : '';
    root.innerHTML = `<div class="topbar ht-top"><a href="#/hattrick?menu=1" class="back">‹</a>
        <div class="ht-goal"><b class="t0">${fmt(G.scores[0])}</b><span><small>${LEVELS[G.level] || ''}${G.hard ? ' · hidden' : ''}</small>Goal ${TARGET}</span><b class="t1">${fmt(G.scores[1])}</b></div>
        <span class="top-btns">${GM.lbButton(mode)}<button class="icon-btn" id="ht-help">?</button></span></div>
      <div class="ht-bidrow"><div class="ht-teambid t0"><small>Our bid</small><b>${G.phase === 'bid' ? teamBid(0) : `${teamWon(0)}/${teamBid(0)}`}</b></div>
        <div class="ht-stat">${statLabel()}<small>Hand ${G.handNo} · 🟨 ${G.bags[0]}/10 v ${G.bags[1]}/10</small></div>
        <div class="ht-teambid t1"><small>Their bid</small><b>${G.phase === 'bid' ? teamBid(1) : `${teamWon(1)}/${teamBid(1)}`}</b></div></div>
      <div class="ht-table">
        ${pill(2, 'n')}${pill(1, 'w')}${pill(3, 'e')}${pill(0, 's')}
        ${G.phase === 'bid' && G.turn === 0 ? bidPanel() : trickHtml()}
      </div>
      <p class="ht-tip">${tip}</p>
      <div class="ht-hand ${canPlay ? 'go' : ''}">${G.hands[0].map((c, i) => cardHtml(c, `${ok.has(c.id) ? 'ok' : canPlay ? 'no' : ''} ${picked === c.id ? 'up' : ''}`,
        `left: calc((100% - 58px) * ${n > 1 ? i / (n - 1) : 0.5}); z-index: ${i + 1}`)).join('')}</div>`;
    GM.$('#ht-help', root).onclick = help;
    GM.$$('.ht-hand .ht-card', root).forEach(b => b.onclick = () => {
      if (!canPlay) return;
      const c = G.hands[0].find(x => x.id === b.dataset.card);
      if (!c || !ok.has(c.id)) { GM.toast(G.trick.length ? `Follow the suit led: ${SUITS[G.trick[0].c.s].icon} ${SUITS[G.trick[0].c.s].name}` : '⭐ Legends can’t lead until one has been played'); return; }
      if (picked !== c.id) { picked = c.id; GM.sound.play('tick'); GM.buzz(); return render(); }
      picked = null; play(0, c);
    });
    let bid = null;
    GM.$$('[data-bid]', root).forEach(b => b.onclick = () => {
      bid = +b.dataset.bid; GM.sound.play('tick');
      GM.$$('[data-bid]', root).forEach(x => x.classList.toggle('on', x === b));
      GM.$('#ht-place', root).disabled = false;
    });
    const pb = GM.$('#ht-place', root);
    if (pb) pb.onclick = () => { if (bid == null) return; G.bids[0] = bid; GM.sound.play('place'); GM.buzz(); nextBidder(); };
    tick();
  }
  function bidPanel() {
    const guess = cpuBid(0);
    return `<div class="ht-bid"><h3>Hand ${G.handNo}</h3><b>Select your bid</b>
      <div class="ht-bids">${Array.from({ length: 14 }, (_, n) => `<button data-bid="${n}">${n === 0 ? 'nil' : n}</button>`).join('')}</div>
      <button class="btn big" id="ht-place" disabled>Place bid</button>
      <small>${G.hard ? '' : `🧠 Your hand looks like about ${guess}. `}${G.bids[2] != null ? `${SEATS[2].name} bid ${G.bids[2] === 0 ? 'nil' : G.bids[2]}. ` : ''}Nil: win no tricks (+100, or −100)</small></div>`;
  }
  function handSummary(lines) {
    const [a, b] = G.scores, won = a > b, L = [lines.find(l => l.t === 0), lines.find(l => l.t === 1)];
    const cell = (l, f) => `<td class="t${l.t}">${f(l)}</td>`;
    const lead = a === b ? -1 : a > b ? 0 : 1;
    const m = GM.modal(`<div class="ht-sumbox"><div class="ht-sumtitle">${G.over ? (won ? '🏆 You win!' : '😬 They win') : `Hand ${G.handNo}`}</div>
      <table class="ht-sum"><tr><th></th><th class="t0">${lead === 0 ? '👑<br>' : ''}Us</th><th class="t1">${lead === 1 ? '👑<br>' : ''}Them</th></tr>
        <tr><td>Bid</td>${L.map(l => cell(l, x => `${x.won}/${x.bid}${x.nil.map(n => ` · nil ${n.ok ? '✅' : '❌'}`).join('')}${x.won >= x.bid && x.bid ? ' ✓' : ''}`)).join('')}</tr>
        <tr><td>Bags</td>${L.map(l => cell(l, x => `${G.bags[x.t]}/10${x.red ? ' 🟥' : ''}`)).join('')}</tr>
        <tr><td>This hand</td>${L.map(l => cell(l, x => `<b>${x.pts > 0 ? '+' : ''}${x.pts}</b>`)).join('')}</tr>
        <tr class="total"><td>Total</td><td class="t0">${fmt(a)}</td><td class="t1">${fmt(b)}</td></tr></table>
      ${G.over ? '' : `<p class="muted center small">First to ${TARGET}</p>`}
      <div class="row">${G.over ? '<a class="btn ghost" href="#/hattrick?menu=1" data-close>Menu</a><button class="btn big" id="ht-again">🔁 Play again</button>' : '<button class="btn big ht-go" id="ht-next">Continue</button>'}</div></div>`,
    { onClose: () => { if (!G.over && G.phase === 'handover') { newHand(); save(); render(); } } });
    const nx = GM.$('#ht-next', m.el); if (nx) nx.onclick = () => m.close();
    const ag = GM.$('#ht-again', m.el); if (ag) ag.onclick = () => { m.close(); begin(G.level, G.hard); };
    GM.sound.play(lines[0].pts > lines[1].pts ? 'good' : 'tap');
    if (G.over) finish(won);
  }
  async function finish(won) {
    const mode = G.hard ? 'hattrickh' : 'hattrick', rec = GM.store.get('ht:record', { w: 0, l: 0 });
    rec[won ? 'w' : 'l']++; GM.store.set('ht:record', rec);
    GM.store.set(SAVE, null);
    GM.sound.play(won ? 'fanfare' : 'fulltime');
    if (GM.checkGame) GM.checkGame(mode, G.scores[0], { won, nil: G.history.some(h => h.lines[0].nil.some(n => n.s === 0 && n.ok)) });
    if (won) await GM.recordScore(mode, Math.max(0, G.scores[0] - G.scores[1]));  // the board ranks winning margins
  }
  function rules() {
    return `<p><b>Hat-Trick</b> is football Spades. You and <b>${SEATS[2].name}</b> (opposite you) against ${SEATS[1].name} and ${SEATS[3].name}. First team to <b>${TARGET}</b> wins.</p>
      <p><b>The cards:</b> 52 real Premier League players in four suits: ⚽ Forwards, ⚙️ Midfielders, 🛡️ Defenders and ⭐ <b>Legends</b>, the trumps. A card’s strength is the player’s PL goals, assists or appearances: each game picks one. Choose <b>Hidden</b> numbers to play on your football knowledge alone.</p>
      <p><b>Bid</b> how many of the 13 tricks you’ll win; your bid and your partner’s make your team’s. <b>Nil</b> means none at all: +100 if you manage it, −100 if not.</p>
      <p><b>Play:</b> follow the suit led if you can. The best card of that suit wins, unless someone who can’t follow plays a ⭐ Legend: then the best Legend wins. You can’t lead a Legend until one has been played.</p>
      <p><b>Score:</b> make your team’s bid for 10 a trick, +1 for each extra trick. Extra tricks are 🟨 bags: 10 of them cost 100. Miss your bid and lose 10 a trick.</p>`;
  }
  function help() {
    GM.modal(`<h3>🃏 How to play</h3>${rules()}
      <p class="muted">Record: ${GM.store.get('ht:record', { w: 0 }).w} won, ${GM.store.get('ht:record', { l: 0 }).l} lost</p>
      <div class="row"><button class="btn" data-close>Back to the game</button></div>`);
  }

  /* ---------------------------------------------------------------- the menu */
  const LEVELS = { easy: '😊 Easy', medium: '😐 Medium', hard: '😠 Hard' };
  function intro() {
    const saved = GM.store.get(SAVE, null), rec = GM.store.get('ht:record', { w: 0, l: 0 });
    const level = GM.store.get('ht:level', 'medium'), hidden = GM.store.get('ht:hidden', false);
    root.innerHTML = `<div class="topbar ht-top"><a href="#/" class="back">‹</a><h2>🃏 Hat-Trick <small class="beta-pill">BETA</small></h2><span class="top-btns">${GM.lbButton(hidden ? 'hattrickh' : 'hattrick')}</span></div>
      <div class="ht-intro">
        <p class="ht-blurb">Football Spades. 4 players in 2 teams: bid the tricks you’ll win with a hand of real Premier League players. ⭐ Legends beat everything.</p>
        <div class="ht-vs"><div class="t0"><small>Us</small><b>${SEATS[2].name}</b><b>You</b></div><i>VS</i><div class="t1"><small>Them</small><b>${SEATS[1].name}</b><b>${SEATS[3].name}</b></div></div>
        <div class="ht-opt"><small>Opponents</small><div class="seg" id="ht-level">${Object.entries(LEVELS).map(([k, l]) => `<button data-v="${k}" class="${k === level ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="ht-opt"><small>Card numbers</small><div class="seg" id="ht-hidden"><button data-v="0" class="${hidden ? '' : 'on'}">👀 Shown</button><button data-v="1" class="${hidden ? 'on' : ''}">🙈 Hidden</button></div></div>
        ${saved && saved.hands ? `<button class="btn big ht-go" id="ht-resume">▶ Carry on · hand ${saved.handNo}, ${saved.scores[0]}–${saved.scores[1]}</button><button class="btn ghost" id="ht-play">New game</button>`
          : '<button class="btn big ht-go" id="ht-play">Play</button>'}
        <p class="muted center">Record: ${rec.w} won · ${rec.l} lost</p>
        <details class="ht-rules"><summary>How to play</summary><div>${rulesText()}</div></details>
      </div>`;
    const wire = (id, key, conv) => GM.$$(`#${id} [data-v]`, root).forEach(b => b.onclick = () => { GM.store.set(key, conv(b.dataset.v)); GM.sound.play('tick'); intro(); });
    wire('ht-level', 'ht:level', v => v); wire('ht-hidden', 'ht:hidden', v => v === '1');
    GM.$('#ht-play', root).onclick = () => begin(GM.store.get('ht:level', 'medium'), GM.store.get('ht:hidden', false));
    const rs = GM.$('#ht-resume', root); if (rs) rs.onclick = () => { resume(saved); };
  }
  const rulesText = () => rules().replace(/<b>Hat-Trick<\/b> is football Spades\. /, '');

  /* ---------------------------------------------------------------- start (or carry on) */
  function begin(level, hidden) {
    busy = false; picked = null;
    newGame(!!hidden); G.level = level || 'medium'; save();
    GM.sound.play('whistle');
    render();
    setTimeout(() => GM.toast(`🃏 This game: ${statLabel()}${G.hard ? ' · 🙈 numbers hidden' : ''}`), 300);
  }
  function resume(saved) {
    busy = false; picked = null;
    G = saved; G.hard = !!saved.hard; G.level = saved.level || 'medium';
    if (G.trick.length === 4) { G.played.push(...G.trick.map(t => t.c)); G.trick = []; }  // closed mid-trick
    if (G.phase === 'handover' || (G.phase === 'play' && G.played.length === 52)) { newHand(); save(); }
    render();
  }
  // #/hattrick: the menu (with Carry on if there's a game saved); #/hattrick?menu=1 too
  GM.hattrick = function (el) { root = el; G = null; busy = false; picked = null; intro(); };
  // for tests: the rules, without the table
  GM.hattrickRules = { deal, legal: s => legal(s), winning: t => winning(t), get state() { return G; }, set state(v) { G = v; }, cpuBid, cpuPlay };
})();
