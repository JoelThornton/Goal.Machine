/* Goal Machine – 🃏 Hat-Trick: football Spades (beta)
   You and Skipper against the Gaffer and the Pundit, played on a pitch. A fresh deck of real PL players in four suits:
   🛡️ Defenders, ⚙️ Midfielders, ⚽ Forwards and ⭐ Legends (the trumps), plus two jokers. A card's strength is the
   player's PL goals, assists or appearances (each game picks one); the numbers can be shown or hidden.
   Jokers (the lowest Defender and Midfielder make way, so everyone still gets 13): they can be played at any time,
   but not led. 🦸 Super-Sub wins the trick, whatever else is played. 📺 VAR: the LOWEST card of the suit led wins
   instead of the highest (Legends don't count); a Super-Sub still beats it.
   Bid the tricks you'll win (0 = Nil), follow suit, Legends trump and can't be led until one has been played.
   Make your team's bid for 10 a trick, +1 per extra trick (🟨 bags: ten cost 100); miss it and lose 10 a trick.
   Nil: +100 made, −100 missed. First team to 250 wins (a team on −200 loses). */
'use strict';

(function () {
  const SUITS = {
    L: { icon: '⭐', name: 'Legends' }, F: { icon: '⚽', name: 'Forwards' }, M: { icon: '⚙️', name: 'Midfielders' },
    D: { icon: '🛡️', name: 'Defenders' }, J: { icon: '🃏', name: 'Jokers' },
  };
  const JOKERS = { sub: { icon: '🦸', name: 'Super-Sub', rule: 'Wins the trick, whatever else is played' },
    var: { icon: '📺', name: 'VAR', rule: 'The lowest card of the suit led wins instead' } };
  const SUIT_ORDER = ['J', 'L', 'F', 'M', 'D'];
  const STAT = { goals: 'goals', assists: 'ast', apps: 'apps' };
  const SEATS = [{ name: 'You' }, { name: 'Gaffer' }, { name: 'Skipper' }, { name: 'Pundit' }];
  // seat names from where you sit (online, a friend sits opposite team; the computers are Skipper and the Gaffer)
  const nameOf = s => (G && G.names ? G.names[s] : SEATS[s].name);
  const ME = () => (G && G.me != null ? G.me : 0);
  const LEVELS = { easy: '😊 Easy', medium: '😐 Medium', hard: '😠 Hard' };
  const TARGET = 250, FLOOR = -200, SAVE = 'ht:save';
  const team = s => s % 2;                   // team 0: you (0) + Skipper (2); team 1: Gaffer (1) + Pundit (3)
  const partner = s => (s + 2) % 4;
  const fmt = n => n.toLocaleString();
  const legendOf = p => p.hon.H || p.hon.B || p.goals >= 100;
  let G = null, root = null, busy = false, picked = null;

  /* ---------------------------------------------------------------- the deck */
  // 13 players a suit, picked by fame (so you know most of them), with no two alike in the game's stat; then the
  // lowest Defender and Midfielder make way for the two jokers
  function deal(seed, stat) {
    const r = GM.rng(seed + '|deal'), key = STAT[stat], used = new Set(), cards = [];
    const pools = {
      L: GM.players.filter(legendOf),
      F: GM.players.filter(p => !legendOf(p) && GM.GROUP[p.poss[0]] === 'F'),
      M: GM.players.filter(p => !legendOf(p) && GM.GROUP[p.poss[0]] === 'M'),
      D: GM.players.filter(p => !legendOf(p) && ['D', 'G'].includes(GM.GROUP[p.poss[0]])),
    };
    ['L', 'F', 'M', 'D'].forEach(s => {
      const vals = new Set(), got = [];
      let pool = pools[s].slice();
      while (got.length < 13 && pool.length) {
        const p = r.weighted(pool, x => Math.sqrt(x.fame));
        pool = pool.filter(x => x !== p);
        if (used.has(p.pk) || vals.has(p[key])) continue;
        used.add(p.pk); vals.add(p[key]); got.push(p);
      }
      got.sort((a, b) => a[key] - b[key]).forEach((p, i) => { if (!(i === 0 && (s === 'D' || s === 'M'))) cards.push({ id: s + i, s, pk: p.pk, v: p[key], rank: i + 1 }); });
    });
    cards.push({ id: 'Jsub', s: 'J', j: 'sub', rank: 0 }, { id: 'Jvar', s: 'J', j: 'var', rank: 0 });
    const sh = r.shuffle(cards);
    return [0, 1, 2, 3].map(i => sh.slice(i * 13, i * 13 + 13));
  }
  const player = c => (c.pk ? GM.byPk.get(c.pk) : null);
  const surname = c => { if (c.j) return JOKERS[c.j].name; const n = player(c).name; return n.includes(' ') ? n.split(' ').slice(1).join(' ') : n; };
  // your hand: jokers, then by suit, strongest first (hidden numbers: A–Z, as the order would give them away)
  const sortHand = h => h && h.sort((a, b) => SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s) || (G.hard ? surname(a).localeCompare(surname(b)) : b.rank - a.rank));

  /* ---------------------------------------------------------------- a new game / hand */
  function newGame(hard, level, pick) {
    const seed = GM.newSeed(), stat = GM.STATS[pick] ? pick : ['goals', 'assists', 'apps'][GM.rng(seed + '|stat').int(3)];
    G = { seed, stat, hard, level, scores: [0, 0], bags: [0, 0], handNo: 0, dealer: 3, history: [], over: false };
    newHand();
  }
  function newHand() {
    G.handNo++;
    G.dealer = (G.dealer + 1) % 4;
    G.hands = deal(G.seed + '|' + G.handNo, G.stat);
    sortHand(G.hands[ME()]);
    G.bids = [null, null, null, null]; G.won = [0, 0, 0, 0];
    G.phase = 'bid'; G.turn = (G.dealer + 1) % 4;
    G.trick = []; G.broken = false; G.played = [];
  }
  const save = () => GM.store.set(SAVE, G.over ? null : G);

  /* ---------------------------------------------------------------- rules */
  const isJ = c => c.s === 'J';
  const ledSuit = (trick = G.trick) => { const t = trick.find(x => !isJ(x.c)); return t ? t.c.s : null; };
  function legal(seat) {
    const h = G.hands[seat], jokers = h.filter(isJ), normal = h.filter(c => !isJ(c));
    if (!normal.length) return h;
    const led = ledSuit();
    if (!led) {  // leading (a joker can't lead, unless the trick so far is only jokers)
      const side = normal.filter(c => c.s !== 'L'), pool = G.broken || !side.length ? normal : side;
      return G.trick.length ? pool.concat(jokers) : pool;
    }
    const follow = normal.filter(c => c.s === led);
    return (follow.length ? follow : normal).concat(jokers);
  }
  const beats = (b, a) => (b.s === 'L' && a.s !== 'L') || (b.s === a.s && b.rank > a.rank);
  // who's winning: a Super-Sub; else with VAR the lowest of the suit led; else the best Legend, or best of the suit led
  function winning(trick = G.trick) {
    const sub = trick.find(t => t.c.j === 'sub');
    if (sub) return sub;
    const normal = trick.filter(t => !isJ(t.c));
    if (!normal.length) return trick[0];
    if (trick.some(t => t.c.j === 'var')) {
      const led = normal[0].c.s;
      return normal.filter(t => t.c.s === led).reduce((w, t) => (t.c.rank < w.c.rank ? t : w));
    }
    return normal.slice(1).reduce((w, t) => (beats(t.c, w.c) ? t : w), normal[0]);
  }

  /* ---------------------------------------------------------------- the computer managers */
  // everything this seat hasn't seen yet
  const unseen = seat => {
    const seen = new Set(G.hands[seat].map(c => c.id).concat(G.played.map(c => c.id), G.trick.map(t => t.c.id)));
    return G.hands.flat().filter(c => !seen.has(c.id));
  };
  const isBoss = (seat, c) => !unseen(seat).some(x => (x.s === c.s && x.rank > c.rank) || x.j === 'sub');
  function cpuBid(seat) {
    const h = G.hands[seat], by = s => h.filter(c => c.s === s), trumps = by('L');
    let est = h.some(c => c.j === 'sub') ? 1 : 0;
    if (h.some(c => c.j === 'var')) est += 0.2;
    trumps.forEach(c => { est += c.rank >= 12 ? 0.95 : c.rank >= 10 ? 0.6 : c.rank >= 8 ? 0.3 : 0.05; });
    est += Math.max(0, trumps.length - 3) * 0.5;
    ['F', 'M', 'D'].forEach(s => {
      const suit = by(s), n = suit.length;
      suit.forEach(c => { est += c.rank === 13 ? (n <= 5 ? 0.85 : 0.6) : c.rank === 12 ? (n >= 2 && n <= 4 ? 0.5 : 0.25) : c.rank === 11 && n >= 3 && n <= 4 ? 0.2 : 0; });
      if (n <= 1 && trumps.length >= 2) est += n === 0 ? 0.6 : 0.3;  // short suits let the trumps in
    });
    let bid = Math.max(1, Math.round(est + (seat !== 0 && G.level === 'easy' ? Math.random() * 2 - 1 : 0)));
    const p = G.bids[partner(seat)];
    if (p != null && p + bid > 10) bid = Math.max(1, 10 - p);
    return Math.min(bid, 7);
  }
  function cpuPlay(seat) {
    const opts = legal(seat);
    // Easy managers often just play something; Medium now and then plays the lowest card when it shouldn't
    if (G.level === 'easy' && Math.random() < 0.4) return opts[Math.floor(Math.random() * opts.length)];
    if (G.level === 'medium' && Math.random() < 0.12) { const n = opts.filter(c => !isJ(c)); if (n.length) return n.sort((x, y) => x.rank - y.rank)[0]; }
    return bestPlay(seat, opts);
  }
  function bestPlay(seat, opts) {
    const low = a => a.slice().sort((x, y) => x.rank - y.rank)[0], high = a => a.slice().sort((x, y) => y.rank - x.rank)[0];
    const t = team(seat), bid = [t, t + 2].reduce((a, s) => a + (G.bids[s] || 0), 0), need = G.won[t] + G.won[t + 2] < bid;
    const normal = opts.filter(c => !isJ(c)), sub = opts.find(c => c.j === 'sub'), vr = opts.find(c => c.j === 'var');
    if (!normal.length) return opts[0];
    const counts = s => G.hands[seat].filter(c => c.s === s).length;
    if (!ledSuit()) {  // leading
      const side = normal.filter(c => c.s !== 'L');
      if (need) { const boss = normal.filter(c => isBoss(seat, c)); if (boss.length) return high(boss); }
      const pool = side.length ? side : normal, longest = pool.slice().sort((a, b) => counts(b.s) - counts(a.s))[0].s;
      return low(pool.filter(c => c.s === longest));
    }
    const led = ledSuit(), w = winning(), last = G.trick.length === 3, ours = x => x && team(x.seat) === t;
    const after = c => winning(G.trick.concat({ seat, c }));  // what happens if I play this now
    if (G.trick.some(x => x.c.j === 'sub')) return low(normal);  // nothing beats it: throw the cheapest card
    if (G.trick.some(x => x.c.j === 'var')) {  // the lowest of the suit led wins
      const follow = normal.filter(c => c.s === led);
      if (!follow.length) return low(normal);
      return need && !ours(w) ? low(follow) : high(follow);
    }
    const partnerWinning = w.seat === partner(seat) && (last || isBoss(seat, w.c) || w.c.s === 'L');
    const winners = normal.filter(c => beats(c, w.c));
    if (need && !partnerWinning && !winners.length) {
      if (vr && ours(after(vr))) return vr;
      if (sub && (last || G.hands[seat].length <= 4 || bid - (G.won[t] + G.won[t + 2]) >= 2)) return sub;
    }
    if (normal.every(c => c.s === led)) {  // following suit
      if (partnerWinning || !need || !winners.length) return low(normal);
      if (last) return low(winners);
      const top = high(winners); return isBoss(seat, top) ? top : low(normal);
    }
    // can't follow: trump if it matters, otherwise throw the lowest side card (shortest suit first)
    const side = normal.filter(c => c.s !== 'L'), trumps = winners.filter(c => c.s === 'L');
    if (!partnerWinning && need && trumps.length) return low(trumps);
    if (side.length) return side.slice().sort((a, b) => counts(a.s) - counts(b.s) || a.rank - b.rank)[0];
    return low(normal);
  }

  /* ---------------------------------------------------------------- playing it out */
  function play(seat, card) {
    G.hands[seat] = G.hands[seat].filter(c => c.id !== card.id);
    if (card.s === 'L') G.broken = true;
    G.trick.push({ seat, c: card });
    GM.sound.play(isJ(card) ? 'wild' : 'card');
    if (isJ(card)) GM.toast(`${JOKERS[card.j].icon} <b>${seat === ME() ? 'You play' : GM.esc(nameOf(seat)) + ' plays'} ${JOKERS[card.j].name}!</b> ${JOKERS[card.j].rule}`, 2400);
    if (G.trick.length < 4) { G.turn = (seat + 1) % 4; save(); return render(); }
    // trick done: show it, then the winner takes it and leads the next
    const w = winning();
    G.won[w.seat]++;
    G.turn = w.seat;
    render();
    setTimeout(() => GM.sound.play(team(w.seat) === US() ? 'trickwin' : 'tricklose'), 250);
    busy = true;
    setTimeout(() => {
      busy = false;
      G.played.push(...G.trick.map(t => t.c));
      G.trick = [];
      if (G.played.length === 52) return endHand();
      save(); render();
    }, 1400);
  }
  function scoreHand() {
    const lines = [0, 1].map(t => {
      const seats = [t, t + 2];
      let pts = 0, bags = 0, red = 0;
      const nilSeats = seats.filter(s => G.bids[s] === 0), bidSeats = seats.filter(s => G.bids[s] > 0);
      nilSeats.forEach(s => { pts += G.won[s] === 0 ? 100 : -100; bags += G.won[s]; });
      const bid = bidSeats.reduce((a, s) => a + G.bids[s], 0), won = bidSeats.reduce((a, s) => a + G.won[s], 0);
      if (bid) { if (won >= bid) { pts += 10 * bid; bags += won - bid; } else pts -= 10 * bid; }
      pts += bags;
      G.bags[t] += bags;
      while (G.bags[t] >= 10) { G.bags[t] -= 10; pts -= 100; red++; }
      G.scores[t] += pts;
      return { t, bid, won: seats.reduce((a, s) => a + G.won[s], 0), made: !bid || won >= bid, nil: nilSeats.map(s => ({ s, ok: G.won[s] === 0 })), pts, bags, red };
    });
    G.history.push({ hand: G.handNo, lines });
    const [a, b] = G.scores;
    G.over = (a >= TARGET || b >= TARGET || a <= FLOOR || b <= FLOOR) && a !== b;
    G.phase = 'handover';
    return lines;
  }
  function endHand() {
    const lines = scoreHand();
    save(); render();
    handSummary(lines);
  }
  // a card played, all at once (the online replay): a finished trick goes straight to its winner
  function applyPlay(seat, card) {
    G.hands[seat] = G.hands[seat].filter(c => c.id !== card.id);
    if (card.s === 'L') G.broken = true;
    G.trick.push({ seat, c: card });
    if (G.trick.length < 4) { G.turn = (seat + 1) % 4; return; }
    const w = winning();
    G.won[w.seat]++;
    G.lastTrick = { trick: G.trick.slice(), winner: w.seat, hand: G.handNo };
    G.played.push(...G.trick.map(t => t.c));
    G.trick = []; G.turn = w.seat;
    if (G.played.length === 52) scoreHand();
  }
  function applyBid(seat, n) {
    G.bids[seat] = n;
    if (G.bids.every(b => b != null)) { G.phase = 'play'; G.turn = (G.dealer + 1) % 4; } else G.turn = (seat + 1) % 4;
  }

  /* ---------------------------------------------------------------- the computer's turns */
  function tick() {
    if (!G || busy || G.over || !root || !root.isConnected || !location.hash.startsWith('#/hattrick') || !GM.$('.ht-pitch', root)) return;
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
  // a card: the name runs up the left edge (so it reads in a fanned hand); number and suit top right; initials big
  function cardHtml(c, cls = '', style = '') {
    const num = c.j ? JOKERS[c.j].icon : numShown(c) ? fmt(c.v) : '?';
    // the number is on the edge strip once; the face is the player (photo, or initials in club colours)
    const face = c.j ? `<span class="htc-big">${c.j === 'sub' ? 'SUPER<br>SUB' : 'VAR'}</span>`
      : GM.avatar(player(c), 'htc-face-pic');
    return `<button class="ht-card suit-${c.s} ${c.j ? 'joker-' + c.j : ''} ${cls}" data-card="${c.id}" ${style ? `style="${style}"` : ''} title="${GM.esc(c.j ? JOKERS[c.j].name + ': ' + JOKERS[c.j].rule : player(c).name)}">
      <span class="htc-edge"><b>${c.j ? JOKERS[c.j].icon : num}</b>${c.j ? '' : `<i>${SUITS[c.s].icon}</i>`}<span>${GM.esc(surname(c))}</span></span><span class="htc-face">${face}</span></button>`;
  }
  const statLabel = () => `${GM.STATS[G.stat].icon} ${G.stat === 'apps' ? 'Apps' : GM.STATS[G.stat].name}`;
  const teamBid = t => [t, t + 2].reduce((a, s) => a + (G.bids[s] || 0), 0);
  const teamWon = t => G.won[t] + G.won[t + 2];
  const US = () => team(ME());                 // your team (online you might sit on the guest side)
  const side = s => (team(s) === US() ? 0 : 1); // 0 = us (lime), 1 = them (orange)
  const pill = (s, pos) => `<div class="ht-pill ht-${pos} t${side(s)} ${G.turn === s && G.phase !== 'handover' && !G.over && G.trick.length < 4 ? 'turn' : ''}">
      <b>${GM.esc(nameOf(s))}</b>${G.bids[s] != null ? `<span class="ht-badge">${G.phase === 'bid' ? (G.bids[s] === 0 ? 'Nil' : G.bids[s]) : `${G.won[s]}/${G.bids[s] === 0 ? 'Nil' : G.bids[s]}`}</span>` : ''}</div>`;
  function trickHtml() {
    const me = ME();
    // online, between tricks: the last trick stays on the table so you can see what happened while you were away
    const last = G.online && !G.trick.length && G.lastTrick && G.lastTrick.hand === G.handNo ? G.lastTrick : null;
    const cards = G.trick.length ? G.trick : last ? last.trick : [];
    const w = G.trick.length === 4 ? winning() : last ? cards.find(t => t.seat === last.winner) : null;
    const at = s => { const t = cards.find(x => x.seat === s); return t ? cardHtml(t.c, `played ${w && w.seat === s ? 'win' : ''} ${last ? 'last' : ''}`) + `<span class="ht-tname">${GM.esc(t.c.j ? JOKERS[t.c.j].name : player(t.c).name)}</span>` : ''; };
    return `<div class="ht-trick ${last ? 'is-last' : ''}"><div class="ht-t2">${at(partner(me))}</div><div class="ht-t1">${at((me + 1) % 4)}</div><div class="ht-t3">${at((me + 3) % 4)}</div><div class="ht-t0">${at(me)}</div></div>`;
  }
  function render() {
    if (!root || !root.isConnected) return;
    if (!G) return intro();
    const me = ME(), us = US(), them = 1 - us;
    const canPlay = G.phase === 'play' && G.turn === me && G.trick.length < 4 && !busy && !G.sending;
    const ok = canPlay ? new Set(legal(me).map(c => c.id)) : new Set();
    const hand = G.hands[me] || [], n = hand.length, led = ledSuit();
    const last = G.online && !G.trick.length && G.lastTrick && G.lastTrick.hand === G.handNo ? G.lastTrick : null;
    const w = G.trick.length === 4 ? winning() : null;
    const who = s => (s === me ? 'You' : nameOf(s));
    const waitingOn = s => (G.online && G.online.human(s) ? `Waiting for ${GM.esc(nameOf(s))}…` : `${GM.esc(nameOf(s))} is ${G.phase === 'bid' ? 'bidding' : 'thinking'}…`);
    const tip = G.over ? `<b>${G.scores[us] > G.scores[them] ? '🏆 You win!' : '😬 They win'}</b>`
      : w ? `<b class="t${side(w.seat)}">${side(w.seat) === 0 ? '⚽' : '🥅'} ${w.seat === me ? 'You win' : `${GM.esc(nameOf(w.seat))} wins`} the trick</b>`
      : G.phase === 'bid' ? (G.turn === me ? '' : waitingOn(G.turn))
      : canPlay ? (picked ? 'Tap it again to play it' : led ? `Your turn: follow ${SUITS[led].icon} ${SUITS[led].name} if you can` : `${last ? `${who(last.winner)} took the last trick. ` : ''}Your lead${G.broken ? '' : ' · ⭐ Legends not broken yet'}`)
      : G.phase === 'play' ? waitingOn(G.turn) : '';
    const bags = t => `<i class="ht-bags" title="Bags">${G.bags[t] ? '🟨'.repeat(G.bags[t]) : ''}</i>`;
    const back = G.online ? '#/online' : '#/hattrick';
    root.innerHTML = `<div class="topbar ht-top"><a href="${back}" class="back">‹</a>
        <div class="ht-board"><div class="t0"><small>Us</small><b>${fmt(G.scores[us])}</b></div><div class="ht-mid"><b>${statLabel()}</b><small>First to ${TARGET}</small></div><div class="t1"><small>Them</small><b>${fmt(G.scores[them])}</b></div></div>
        <span class="top-btns"><button class="icon-btn" id="ht-help">?</button></span></div>
      ${G.online ? G.online.bar || '' : ''}
      <div class="ht-bidrow"><div class="ht-teambid t0"><small>Our bid</small><b>${G.phase === 'bid' ? teamBid(us) : `${teamWon(us)}/${teamBid(us)}`}</b>${bags(us)}</div>
        <small class="ht-hand-no">Hand ${G.handNo}<br>${G.online ? '🌐 Online' : LEVELS[G.level] || ''}${G.hard ? ' · 🙈' : ''}</small>
        <div class="ht-teambid t1"><small>Their bid</small><b>${G.phase === 'bid' ? teamBid(them) : `${teamWon(them)}/${teamBid(them)}`}</b>${bags(them)}</div></div>
      <div class="ht-pitch"><div class="ht-lines"></div>
        ${pill(partner(me), 'n')}${pill((me + 1) % 4, 'w')}${pill((me + 3) % 4, 'e')}${pill(me, 's')}
        ${G.phase === 'bid' && G.turn === me && !G.over ? bidPanel() : trickHtml()}
      </div>
      ${picked && canPlay && hand.some(c => c.id === picked) ? previewHtml(hand.find(c => c.id === picked)) : `<p class="ht-tip">${tip}</p>`}
      <div class="ht-hand ${canPlay ? 'go' : ''}">${hand.map((c, i) => cardHtml(c, `${ok.has(c.id) ? 'ok' : canPlay ? 'no' : ''} ${picked === c.id ? 'up' : ''}`,
        `left: calc((100% - 62px) * ${n > 1 ? i / (n - 1) : 0.5}); z-index: ${i + 1}`)).join('')}</div>
      ${G.online ? G.online.foot || '' : ''}`;
    GM.$('#ht-help', root).onclick = help;
    if (G.online && G.online.wire) G.online.wire(root);
    const pv = GM.$('#ht-playit', root);
    if (pv) pv.onclick = () => { const c = hand.find(x => x.id === picked); picked = null; if (!c) return render(); if (G.online) G.online.send({ t: 'p', c: c.id }); else play(me, c); };
    const px = GM.$('#ht-putback', root); if (px) px.onclick = () => { picked = null; render(); };
    GM.$$('.ht-hand .ht-card', root).forEach(b => b.onclick = () => {
      if (!canPlay) return;
      const c = hand.find(x => x.id === b.dataset.card);
      if (!c || !ok.has(c.id)) { GM.toast(c && isJ(c) ? '🃏 You can’t lead with a joker' : led ? `Follow the suit led: ${SUITS[led].icon} ${SUITS[led].name}` : '⭐ Legends can’t lead until one has been played'); return; }
      if (picked !== c.id) { picked = c.id; GM.sound.play('tick'); GM.buzz(); return render(); }
      picked = null;
      if (G.online) G.online.send({ t: 'p', c: c.id }); else play(me, c);
    });
    let bid = null;
    GM.$$('[data-bid]', root).forEach(b => b.onclick = () => {
      bid = +b.dataset.bid; GM.sound.play('tick');
      GM.$$('[data-bid]', root).forEach(x => x.classList.toggle('on', x === b));
      GM.$('#ht-place', root).disabled = false;
    });
    const pb = GM.$('#ht-place', root);
    if (pb) pb.onclick = () => {
      if (bid == null) return;
      GM.sound.play('place'); GM.buzz();
      if (G.online) G.online.send({ t: 'b', n: bid }); else { G.bids[me] = bid; nextBidder(); }
    };
    if (!G.online) tick();
  }
  // the card you've picked up, in full: photo, whole name, suit and number (hidden numbers stay hidden), then Play
  function previewHtml(c) {
    if (c.j) return `<div class="ht-preview joker"><span class="htp-pic">${JOKERS[c.j].icon}</span><span class="htp-info"><b>${JOKERS[c.j].name}</b><small>${JOKERS[c.j].rule}</small></span>
      <span class="htp-go"><button class="btn small" id="ht-playit">▶ Play</button><button class="htp-x" id="ht-putback" aria-label="Put it back">✕</button></span></div>`;
    const p = player(c);
    return `<div class="ht-preview suit-${c.s}"><span class="htp-pic">${GM.avatar(p)}</span>
      <span class="htp-info"><b>${GM.esc(p.name)}</b><small>${SUITS[c.s].icon} ${SUITS[c.s].name.replace(/s$/, '')} · ${numShown(c) ? `<b>${fmt(c.v)}</b> ${GM.STATS[G.stat].label}` : `? ${GM.STATS[G.stat].label}`}</small>
        ${G.hard ? '' : `<span class="chips">${p.clubs.slice(0, 4).map(x => GM.clubChip(x)).join('')}</span>`}</span>
      <span class="htp-go"><button class="btn small" id="ht-playit">▶ Play</button><button class="htp-x" id="ht-putback" aria-label="Put it back">✕</button></span></div>`;
  }
  function bidPanel() {
    const me = ME();
    return `<div class="ht-bid"><b>Hand ${G.handNo} · your bid</b>
      <div class="ht-bids">${Array.from({ length: 14 }, (_, n) => `<button data-bid="${n}">${n === 0 ? 'Nil' : n}</button>`).join('')}</div>
      <button class="btn" id="ht-place" disabled>Place bid</button>
      <small>${G.level === 'easy' && !G.hard && !G.online ? `🧠 Looks like about ${cpuBid(me)}. ` : ''}${G.bids[partner(me)] != null ? `${GM.esc(nameOf(partner(me)))} bid ${G.bids[partner(me)] === 0 ? 'Nil' : G.bids[partner(me)]}.` : ''}</small></div>`;
  }
  function handSummary(lines) {
    const us = US(); lines = [lines[us], lines[1 - us]];
    const a = G.scores[us], b = G.scores[1 - us], won = a > b, lead = a === b ? -1 : a > b ? 0 : 1;
    const m = GM.modal(`<div class="ht-sumbox"><div class="ht-sumtitle">${G.over ? (won ? '🏆 Full time: you win!' : '😬 Full time: they win') : `Hand ${G.handNo}: the scores`}</div>
      <table class="ht-sum"><tr><th></th><th class="t0">${lead === 0 ? '👑 ' : ''}Us</th><th class="t1">${lead === 1 ? '👑 ' : ''}Them</th></tr>
        <tr><td>Tricks / bid</td>${lines.map(l => `<td>${l.won}/${l.bid}${l.nil.map(x => ` · Nil ${x.ok ? '✅' : '❌'}`).join('')} ${l.bid ? (l.made ? '✅' : '❌') : ''}</td>`).join('')}</tr>
        <tr><td>Bags 🟨</td>${lines.map(l => `<td>${G.bags[l.t]}/10${l.red ? ' · 🟥 −100' : ''}</td>`).join('')}</tr>
        <tr><td>This hand</td>${lines.map(l => `<td><b>${l.pts > 0 ? '+' : ''}${l.pts}</b></td>`).join('')}</tr>
        <tr class="total"><td>Total</td><td class="t0">${fmt(a)}</td><td class="t1">${fmt(b)}</td></tr></table>
      ${G.over ? '' : `<p class="muted center small">First to ${TARGET}</p>`}
      <div class="row">${G.online ? `<button class="btn big" data-close>${G.over ? 'OK' : 'Next hand ➜'}</button>` : G.over ? '<a class="btn ghost" href="#/hattrick" data-close>Menu</a><button class="btn big" id="ht-again">🔁 Play again</button>' : '<button class="btn big" id="ht-next">Next hand ➜</button>'}</div></div>`,
    { onClose: () => { if (!G.online && !G.over && G.phase === 'handover') { newHand(); save(); render(); } } });
    const nx = GM.$('#ht-next', m.el); if (nx) nx.onclick = () => m.close();
    const ag = GM.$('#ht-again', m.el); if (ag) ag.onclick = () => { m.close(); begin(G.level, G.hard); };
    GM.sound.play(lines[0].pts > lines[1].pts ? 'good' : 'tap');
    if (G.over && !G.online) finish(won);
  }
  async function finish(won) {
    const mode = G.hard ? 'hattrickh' : 'hattrick', rec = GM.store.get('ht:record', { w: 0, l: 0 });
    rec[won ? 'w' : 'l']++; GM.store.set('ht:record', rec);
    GM.store.set(SAVE, null);
    GM.sound.play(won ? 'fanfare' : 'fulltime');
    if (GM.checkGame) GM.checkGame(mode, G.scores[0], { won, nil: G.history.some(h => h.lines[0].nil.some(x => x.s === 0 && x.ok)) });
    if (won) await GM.recordScore(mode, Math.max(0, G.scores[0] - G.scores[1]));  // the board ranks winning margins
  }
  const rules = () => `<p><b>The cards:</b> real Premier League players in four suits: ⚽ Forwards, ⚙️ Midfielders, 🛡️ Defenders and ⭐ <b>Legends</b>, the trumps. A card’s strength is the player’s PL goals, assists or appearances (each game picks one). Choose <b>🙈 Hidden</b> numbers to play on your football knowledge.</p>
      <p><b>Two jokers:</b> 🦸 <b>Super-Sub</b> wins the trick, whatever else is played. 📺 <b>VAR</b>: the <b>lowest</b> card of the suit led wins instead (Legends don’t count, and a Super-Sub still wins). Play a joker any time, but you can’t lead with one.</p>
      <p><b>Bid</b> how many of the 13 tricks you’ll win: yours and Skipper’s make your team’s bid. <b>Nil</b> means none at all: +100 if you manage it, −100 if not.</p>
      <p><b>Play:</b> follow the suit led if you can. The best card of that suit wins, unless someone who can’t follow plays a ⭐ Legend. You can’t lead a Legend until one has been played.</p>
      <p><b>Score:</b> make your bid for 10 a trick, +1 for each extra trick. Extra tricks are 🟨 bags: 10 of them cost 100. Miss your bid and lose 10 a trick. First to <b>${TARGET}</b>.</p>`;
  function help() {
    GM.modal(`<h3>🃏 How to play</h3>${rules()}
      <p class="muted">Record: ${GM.store.get('ht:record', { w: 0 }).w} won, ${GM.store.get('ht:record', { l: 0 }).l} lost</p>
      <div class="row"><button class="btn" data-close>Back to the game</button></div>`);
  }

  /* ---------------------------------------------------------------- the menu */
  // one card of each kind, so you can see the deck before you play
  function fanDemo() {
    const top = f => GM.players.filter(f).sort((a, b) => b.fame - a.fame)[0];
    const ex = [['L', top(legendOf)], ['F', top(p => !legendOf(p) && GM.GROUP[p.poss[0]] === 'F')], ['M', top(p => !legendOf(p) && GM.GROUP[p.poss[0]] === 'M')], ['D', top(p => !legendOf(p) && GM.GROUP[p.poss[0]] === 'D')]];
    const was = G; G = { hard: false, played: [], trick: [] };
    const html = ex.filter(([, p]) => p).map(([s, p]) => cardHtml({ id: 'demo' + s, s, pk: p.pk, v: p.goals }, 'demo')).join('')
      + cardHtml({ id: 'Jsub', s: 'J', j: 'sub' }, 'demo') + cardHtml({ id: 'Jvar', s: 'J', j: 'var' }, 'demo');
    G = was;
    return html;
  }
  function intro() {
    const saved = GM.store.get(SAVE, null), rec = GM.store.get('ht:record', { w: 0, l: 0 });
    const level = GM.store.get('ht:level', 'medium'), hidden = GM.store.get('ht:hidden', false);
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🃏 Hat-Trick <small class="beta-pill">BETA</small></h2><span class="top-btns">${GM.lbButton(hidden ? 'hattrickh' : 'hattrick')}</span></div>
      <div class="ht-intro">
        <div class="ht-sheet"><div class="ht-lines"></div>
          <div class="ht-side t0"><small>Us</small><b>You</b><b>Skipper</b></div><i>v</i><div class="ht-side t1"><small>Them</small><b>Gaffer</b><b>Pundit</b></div></div>
        <p class="ht-blurb">Football Spades: bid the tricks you’ll win with a hand of real Premier League players. ⭐ Legends are trumps, and look out for the 🦸 Super-Sub and 📺 VAR.</p>
        <div class="ht-fan">${fanDemo()}</div>
        <div class="ht-opt"><small>Opponents</small><div class="seg" id="ht-level">${Object.entries(LEVELS).map(([k, l]) => `<button data-v="${k}" class="${k === level ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="ht-opt"><small>Card strength</small><div class="seg" id="ht-stat">${[['random', '🎲 Surprise'], ...Object.entries(GM.STATS).map(([k, st]) => [k, `${st.icon} ${k === 'apps' ? 'Apps' : st.name}`])].map(([k, l]) => `<button data-v="${k}" class="${k === GM.store.get('ht:stat', 'random') ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="ht-opt"><small>Card numbers</small><div class="seg" id="ht-hidden"><button data-v="0" class="${hidden ? '' : 'on'}">👀 Shown</button><button data-v="1" class="${hidden ? 'on' : ''}">🙈 Hidden</button></div></div>
        ${saved && saved.hands ? `<button class="btn big" id="ht-resume">▶ Carry on · hand ${saved.handNo}, ${saved.scores[0]}–${saved.scores[1]}</button><button class="btn ghost" id="ht-play">New game</button>`
          : '<button class="btn big" id="ht-play">🃏 Deal me in</button>'}
        <p class="muted center">Record: ${rec.w} won · ${rec.l} lost</p>
        <details class="ht-rules"><summary>How to play</summary>${rules()}</details>
      </div>`;
    const wire = (id, key, conv) => GM.$$(`#${id} [data-v]`, root).forEach(b => b.onclick = () => { GM.store.set(key, conv(b.dataset.v)); GM.sound.play('tick'); intro(); });
    wire('ht-level', 'ht:level', v => v); wire('ht-hidden', 'ht:hidden', v => v === '1'); wire('ht-stat', 'ht:stat', v => v);
    GM.$('#ht-play', root).onclick = () => begin(GM.store.get('ht:level', 'medium'), GM.store.get('ht:hidden', false));
    const rs = GM.$('#ht-resume', root); if (rs) rs.onclick = () => resume(saved);
  }

  /* ---------------------------------------------------------------- start (or carry on) */
  function begin(level, hidden) {
    busy = false; picked = null;
    newGame(!!hidden, level || 'medium', GM.store.get('ht:stat', 'random')); save();
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
  // #/hattrick: the menu (with Carry on if there's a game saved)
  GM.hattrick = function (el) {
    root = el; G = null; busy = false; picked = null;
    // from a Quick match nobody joined: straight into a game against the computers
    if (GM.store.get('ht:autostart', 0)) { GM.store.set('ht:autostart', 0); return begin(GM.store.get('ht:level', 'medium'), GM.store.get('ht:hidden', false)); }
    intro();
  };
  /* ---------------------------------------------------------------- online: you + Skipper v your mate + their Skipper */
  // The room stores only the two humans' moves ({t:'b', n} bids and {t:'p', c} cards, with s = host/guest). Both phones
  // rebuild the game from the room's seed: the computers (seats 2 and 3) play the Hard, never-random way, so they make
  // the same moves on both phones. Host = seat 0 (partner 2), guest = seat 1 (partner 3).
  function replay(r, mySeat, moves = r.moves) {
    const me = mySeat === 'guest' ? 1 : 0, other = me ? 'host' : 'guest';
    const names = [];
    names[me] = 'You'; names[1 - me] = r[other] || 'Your mate';
    names[2] = me === 0 ? 'Skipper' : 'Gaffer'; names[3] = me === 1 ? 'Skipper' : 'Gaffer';
    G = { seed: r.seed, stat: GM.STATS[r.stat] ? r.stat : 'goals', hard: false, level: 'hard', scores: [0, 0], bags: [0, 0], handNo: 0, dealer: 3, history: [], over: false, me, names };
    newHand();
    let i = 0, waiting = null, bad = false;
    for (let guard = 0; guard < 4000 && !G.over; guard++) {
      if (G.phase === 'handover') { newHand(); continue; }
      const t = G.turn;
      if (t >= 2) { if (G.phase === 'bid') applyBid(t, cpuBid(t)); else applyPlay(t, cpuPlay(t)); continue; }
      const mv = moves[i];
      if (!mv) { waiting = t; break; }
      if (mv.s !== (t === 0 ? 'host' : 'guest')) { bad = true; break; }
      if (mv.t === 'b' && G.phase === 'bid') applyBid(t, Math.max(0, Math.min(13, +mv.n || 0)));
      else if (mv.t === 'p' && G.phase === 'play') {
        const c = G.hands[t].find(x => x.id === mv.c);
        if (!c || !legal(t).some(x => x.id === c.id)) { bad = true; break; }
        applyPlay(t, c);
      } else { bad = true; break; }
      i++;
    }
    return { waiting, bad };
  }
  GM.hattrickOnline = function (el, r, seat, api) {
    root = el; busy = false;
    const done = r.status === 'done' || r.status === 'declined';
    const { waiting, bad } = replay(r, seat);
    const seenKey = 'htseen:' + r.code, seen = GM.store.get(seenKey, 0);
    const turnFor = w => (w === 0 ? 'host' : w === 1 ? 'guest' : 'none');
    const finalAll = () => ({ host: { done: true, t: G.scores[0] }, guest: { done: true, t: G.scores[1] } });
    const res = r.result, iWon = res && res.winner === seat;
    G.online = {
      human: s => s < 2,
      bar: (api.inviteBar(r) || '') + (bad ? '<div class="banner">⚠️ This game got out of step. Tap ‹ and open it again.</div>' : '')
        + (done && res ? `<div class="banner race-final">${res.resigned ? (res.resigned === seat ? '🏳️ You resigned' : `🏳️ ${GM.esc(r[seat === 'host' ? 'guest' : 'host'])} resigned`) : res.winner === 'draw' ? '🤝 A draw' : iWon ? '🏆 You win!' : `😬 ${GM.esc(r[res.winner])} wins`}</div>` : ''),
      foot: done ? '' : `<div class="actions"><button class="btn ghost small" id="oresign">🏳️ ${r.guest ? 'Resign' : r.quick ? 'Stop searching' : 'Cancel invite'}</button></div>`,
      wire: root => { api.wireInvite(root, r); api.resignButton(root, r, seat); },
      send: async move => {
        if (G.sending || done) return;
        G.sending = true;
        const moves = r.moves.concat({ ...move, s: seat });
        const after = replay(r, seat, moves);  // where it goes next: the other human, back to you, or full time
        const args = { ...api.auth(), p_code: r.code, p_seq: r.moves.length, p_move: move, p_sum: null, p_turn: G.over ? 'none' : turnFor(after.waiting), p_all: G.over ? finalAll() : null };
        let out = 'error';
        try { out = await api.rpc('online_move', args); } catch (e) { }
        if (out === 'ok') { r.moves = moves; GM.sound.play(move.t === 'b' ? 'place' : 'card'); }
        else GM.toast(out === 'conflict' ? 'Your mate moved first – catching up' : 'Couldn’t reach the server – try again');
        api.refresh();
      },
    };
    if (!r.guest && !done) G.names[seat === 'host' ? 1 : 0] = r.quick ? 'Opponent' : 'Your mate';
    render();
    // a finished hand (or the final whistle) you haven't seen yet
    if (G.history.length > seen) {
      GM.store.set(seenKey, G.history.length);
      if (seen > 0 || G.history.length === 1 || G.over) handSummary(G.history[G.history.length - 1].lines);
    }
    // full time but the server hasn't heard: tell it (whoever gets here first)
    if (G.over && !done) api.rpc('online_move', { ...api.auth(), p_code: r.code, p_seq: r.moves.length, p_move: null, p_sum: null, p_turn: 'none', p_all: finalAll() }).then(() => api.refresh()).catch(() => { });
  };

  // for tests: the rules, without the table
  GM.hattrickRules = { deal, legal: s => legal(s), winning: t => winning(t), get state() { return G; }, set state(v) { G = v; }, cpuBid, cpuPlay, replay };
})();
