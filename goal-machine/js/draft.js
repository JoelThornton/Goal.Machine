/* Goal Machine – the XI draft: Ultimate Wildcard (most goals/assists/apps), Target (hit a number) and the Daily */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SIDE = { LB: 0, LM: 0, RB: 2, RM: 2 }; // for left-to-right ordering on the pitch
  const WIDE_MIDS = [5, 8];
  // Target mode numbers - simulated so each is reachable in ~70% of games by someone picking the biggest numbers
  const TARGETS = { goals: 500, assists: 350, apps: 3750 };
  // The Treble: hit all three at once (above what a random team gets, below what a greedy one gets)
  const TREBLE = { goals: 400, assists: 300, apps: 3300 };
  // Mystery Target: stat and number are drawn at random; the number stays hidden until full time
  const MYSTERY = { goals: [300, 650], assists: [220, 420], apps: [2600, 4200] };
  const STAT_KEYS = ['goals', 'assists', 'apps'];
  // "big number" filter for the Centurion Throw, per stat
  const BIG = { goals: 100, assists: 50, apps: 400 };

  // kind: 'reveal' | 'respin' | 'special' (themed spin) | 'formation' | 'modifier' | 'sub'
  const WILDCARDS = {
    scout: { icon: '🔍', name: "Scout's IQ", w: 3, kind: 'reveal', desc: st => `See the PL ${st.label} of the players on the reels this turn.` },
    respin: { icon: '🎰', name: 'Roll Again', w: 3, kind: 'respin', desc: () => 'Throw these back and spin again – free.' },
    sub: { icon: '🔄', name: 'Make a Sub', w: 2, kind: 'sub', desc: st => `Release a player from your XI. His ${st.label} come off.` },
    centurion: { icon: '💯', name: 'Centurion Throw', w: 1.5, kind: 'special', desc: st => `A free spin of players with ${BIG[st.id]}+ PL ${st.bigLabel || st.label}.`, filter: (p, st) => p[st.key] >= BIG[st.id] },
    gegenpress: { icon: '⚡', name: 'Gegenpress', w: 1.5, kind: 'formation', desc: () => 'Your empty LM and RM slots push up and become strikers.' },
    bus: { icon: '🚌', name: 'Park the Bus', w: 1.5, kind: 'formation', desc: () => 'Two empty attacking slots drop back to centre-back.' },
    captain: { icon: '©️', name: "Captain's Armband", w: 1.5, kind: 'modifier', desc: st => `Your next signing’s ${st.label} count double.` },
    rotation: { icon: '🩹', name: 'Rotation Risk', w: 1.5, kind: 'modifier', desc: st => `Your next signing’s ${st.label} count half (rounded down).` },
    coin: { icon: '🎲', name: 'Double or Nothing', w: 1, kind: 'modifier', desc: st => `Coin toss on your next signing: his ${st.label} count ×2… or ×0.` },
    deadline: { icon: '⏰', name: 'Deadline Day', w: 1.5, kind: 'special', desc: () => 'A free spin with FIVE players to choose from.', reels: 5 },
    oneclub: { icon: '❤️', name: 'One-Club Man', w: 1, kind: 'special', desc: () => 'A free spin of players who only played for one PL club.', filter: p => p.clubs.length === 1 },
    journeyman: { icon: '🧳', name: 'Journeyman', w: 1, kind: 'special', desc: () => 'A free spin of players who turned out for 4+ PL clubs.', filter: p => p.clubs.length >= 4 },
    throwback: { icon: '📼', name: '90s Throwback', w: 1, kind: 'special', desc: () => 'A free spin of players whose PL career began in the 1990s.', filter: p => p.first <= 1999 },
  };

  const RULES = {
    // purist mode: no target, rack up the biggest total you can; every player equally likely
    ultimate: { max: true, weight: () => 1, noWild: ['rotation', 'bus'] },
    // hit the number: reels lean towards well-known players so big numbers are in reach
    target: { max: false, weight: p => p.fame, noWild: [] },
    // three targets at once
    treble: { max: false, treble: true, weight: p => p.fame, noWild: [] },
    // random stat + hidden number, with a thermometer
    mystery: { max: false, mystery: true, weight: p => p.fame, noWild: [] },
  };
  RULES.daily = RULES.ultimate;
  // Club XI: Ultimate Wildcard with only players who turned out for one club
  RULES.club = { max: true, weight: () => 1, noWild: ['rotation', 'bus'], club: true };

  let S = null; // game state
  let root = null;

  GM.draft = { start, RULES, WILDCARDS, TARGETS, state: () => S, render: () => render(), modeKey: (m, s, h, c) => keyFor(m, s, h, c) };

  const statSuffix = s => ({ goals: '', assists: 'ast', apps: 'apps' }[s] || '');
  function keyFor(mode, stat, hard, club) {
    if (mode === 'daily') return 'daily:' + GM.today();
    if (mode === 'club') return 'club' + GM.slug(club || '') + statSuffix(stat);
    return (mode === 'treble' || mode === 'mystery' ? mode : mode + statSuffix(stat)) + (hard ? 'h' : '');
  }

  function start(el, mode, opts = {}) {
    root = el;
    if (!RULES[mode]) mode = 'ultimate';
    const seed = mode === 'daily' ? 'daily:' + GM.today() : (opts.seed || GM.newSeed());
    let stat = mode === 'daily' ? 'goals' : (GM.STATS[opts.stat] ? opts.stat : 'goals');
    let target = RULES[mode] && !RULES[mode].max ? TARGETS[stat] : null;
    if (mode === 'treble') { stat = 'goals'; target = null; }
    if (mode === 'mystery') {
      // seeded, so a challenge link gets the same mystery
      const r = GM.rng(seed + '|mystery');
      stat = STAT_KEYS[r.int(3)];
      const [lo, hi] = MYSTERY[stat];
      target = lo + r.int(hi - lo + 1);
    }
    if (mode === 'daily') {
      const done = GM.store.get('daily2:' + GM.today());
      if (done && done.xi) { S = done; S.rules = RULES.daily; S.phase = 'done'; S.readonly = true; render(); return; }
      // carry on a Daily Ultimate left half-way (saved on every move, so there's nothing to gain by leaving)
      const saved = GM.store.get(progressKey());
      if (saved && saved.xi) {
        S = saved; S.rules = RULES.daily; S.pending = null; S.subbing = false;
        if (S.phase === 'spinning') S.phase = 'pick';
        GM.toast('Welcome back – carrying on where you left off');
        if (S.phase === 'reveal') { completePick(); return; }
        render(); return;
      }
    }
    const club = mode === 'club' ? (opts.club && GM.clubs.includes(opts.club) ? opts.club : GM.favClub()) : null;
    if (mode === 'club' && !club) { location.hash = '#/settings'; GM.toast('Pick your favourite club first'); return; }
    S = {
      mode, stat, seed, rules: RULES[mode], st: { ...GM.STATS[stat], id: stat },
      target, spin: 0, respins: 0, revealStage: mode === 'mystery' ? 'intro' : null,
      xi: FORMATION.map(pos => ({ pos, p: null, g: 0, mod: null, as: null })),
      reels: [], selected: -1, revealed: false, revealNext: false, special: null,
      inv: [], modifier: null, subbing: false, used: [], last: null,
      phase: 'spin', vs: opts.vs, vss: opts.vss, log: [], pending: null, wildUsed: 0, coinWin: false,
      hard: mode !== 'daily' && !!opts.hard, club,
    };
    render();
  }

  const modeKey = () => keyFor(S.mode, S.stat, S.hard, S.club);
  const progressKey = () => 'dailyp:' + GM.today();
  const distKey = () => S.mode === 'daily' ? 'daily' : modeKey();
  // Hard mode flattens the star bias in the target modes (Shearer ~4x an average player instead of ~16x) but keeps the
  // same targets - big numbers are rarer, so one wrong pick can put the target out of reach.
  const reelWeight = () => (S.hard && !S.rules.max ? p => Math.sqrt(S.rules.weight(p)) : S.rules.weight);
  // what wildcard descriptions talk about: in the Treble a wildcard affects all three numbers
  const wst = () => S.rules.treble ? { ...S.st, label: 'numbers', bigLabel: 'goals' } : S.st;
  const modeName = () => S.mode === 'club' ? GM.MODES[modeKey()].name : GM.MODES[S.mode === 'daily' ? 'daily' : (S.rules.treble || S.rules.mystery) ? S.mode : S.mode + statSuffix(S.stat)].name;
  const val = p => p[S.st.key];
  const pv = p => ({ goals: p.goals, assists: p.ast, apps: p.apps });
  const tot = k => S.xi.reduce((t, s) => t + (s.v ? s.v[k] : 0), 0);
  const total = () => tot(S.stat);
  const openPos = () => [...new Set(S.xi.filter(s => s.p == null).map(s => s.pos))];
  const byId = id => GM.players[id];
  const fits = (p, open) => p.poss.some(x => open.includes(x));
  const emptySlots = () => S.xi.filter(s => s.p == null).length;
  const fmt = n => n.toLocaleString();

  /* ---------------------------------------------------------------- reel generation */
  // Fair deals. Every spin has its own fixed running order of players, drawn from the whole field and seeded by the
  // game seed + spin number (+ which re-roll or special spin it is). The reels are the first players in that order who
  // fit your open positions. So two people on the same seed see the same players on the same spin wherever their
  // positions allow - if Shearer is 1st in spin 3's order, everyone with a striker slot open on spin 3 gets him -
  // and identical decisions always give identical games. Wildcards depend on the spin alone.
  const samplers = new Map();
  function sampler(key, list, w) {
    if (!samplers.has(key)) {
      const cum = []; let t = 0;
      for (const p of list) { t += w(p); cum.push(t); }
      samplers.set(key, { list, cum, t });
    }
    const sm = samplers.get(key);
    return u => {  // binary search the cumulative weights
      let lo = 0, hi = sm.cum.length - 1; const x = u * sm.t;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sm.cum[mid] < x) lo = mid + 1; else hi = mid; }
      return sm.list[lo];
    };
  }
  function makeReels(special) {
    const tag = `${S.seed}|${S.stat}|${S.spin}|${S.spinRespins || 0}|${special || ''}`;
    const r = GM.rng(tag), rw = GM.rng(tag + '|wild');
    const open = openPos();
    const used = new Set(S.used.concat(S.xi.filter(s => s.p != null).map(s => s.p)));
    const ok = p => fits(p, open) && !used.has(p.id);
    const wc = special && WILDCARDS[special];
    const n = (wc && wc.reels) || 3;
    // the field: everyone (or the club's players in Club XI, or a wildcard's theme), as long as it still has someone who fits
    let field = GM.players, fkey = 'all';
    if (S.club) {
      const mine = GM.players.filter(p => p.clubs.includes(S.club));
      if (mine.some(ok)) { field = mine; fkey = 'club:' + S.club; }
    }
    if (wc && wc.filter) {
      const themed = field.filter(p => wc.filter(p, wst()));
      if (themed.some(ok)) { field = themed; fkey += '|' + special; }
    }
    const draw = sampler(`${fkey}|${S.mode}|${S.hard ? 'h' : ''}`, field, reelWeight());
    // wildcard: reel 1 or 2 on 28% of spins each, decided by the spin number only
    let wildAt = -1, wild = null;
    if (!special && S.spin >= 1) {
      if (rw() < 0.28) wildAt = 0; else if (rw() < 0.28) wildAt = 1;
      const types = Object.keys(WILDCARDS).filter(t => !S.rules.noWild.includes(t));
      wild = rw.weighted(types, t => WILDCARDS[t].w);
    }
    const reels = [], taken = new Set();
    for (let i = 0; i < n; i++) {
      if (i === wildAt) { reels.push({ wild }); continue; }
      let p = null;
      for (let tries = 0; tries < 800 && !p; tries++) { const c = draw(r()); if (ok(c) && !taken.has(c.id)) p = c; }
      if (!p) {  // very few players left who fit: pick from them directly
        const rest = field.filter(c => ok(c) && !taken.has(c.id));
        if (!rest.length) break;
        p = r.weighted(rest, reelWeight());
      }
      taken.add(p.id);
      const x = { id: p.id };
      // chemistry hint (a label only, so it doesn't change who you're offered): played with your last signing
      const lp = S.last != null ? byId(S.last) : null;
      if (lp && p.first <= lp.last && p.last >= lp.first && p.clubs.some(c => lp.clubs.includes(c))) x.mate = { name: lp.name, club: p.clubs.find(c => lp.clubs.includes(c)) };
      reels.push(x);
    }
    return reels;
  }

  /* ---------------------------------------------------------------- actions */
  async function doSpin(special) {
    if (S.phase !== 'spin' && S.phase !== 'pick') return;
    S.special = special || null;
    S.pending = null;
    S.reels = makeReels(special);
    S.selected = -1;
    S.revealed = S.revealNext; S.revealNext = false;
    S.phase = 'spinning';
    if (S.spin === 0 && S.respins === 0) GM.sound.play('whistle');
    render();
    await animateReels();
    S.phase = 'pick';
    render();
  }

  async function animateReels() {
    const cards = GM.$$('.reel', root);
    const names = GM.players;
    const stops = cards.map((c, i) => 500 + i * 250);
    const t0 = performance.now();
    let frame = 0;
    await new Promise(res => {
      const tick = () => {
        const t = performance.now() - t0;
        let running = false;
        if (frame++ % 2 === 0) GM.sound.play('tick');
        cards.forEach((c, i) => {
          if (t < stops[i]) {
            running = true;
            const n = c.querySelector('.reel-spin');
            if (n) n.textContent = names[Math.floor(Math.random() * names.length)].name;
          } else if (c.classList.contains('spinning')) {
            c.classList.remove('spinning');
            c.innerHTML = reelInner(S.reels[i]);
            c.classList.add('landed');
            GM.sound.play('land');
          }
        });
        if (running) setTimeout(tick, 55); else res();
      };
      tick();
    });
  }

  // Tapping a player selects him; his possible open slots light up on the pitch and you tap one to sign him.
  function sign(i) {
    const reel = S.reels[i];
    if (!reel || S.phase !== 'pick' || S.subbing !== false) return;
    if (reel.wild) {
      if (S.inv.length >= 3) { GM.toast('Your wildcard bag is full (3) – use one first'); return; }
      S.pending = null;
      S.inv.push(reel.wild);
      S.log.push('🃏');
      GM.sound.play('wild');
      GM.toast(`${WILDCARDS[reel.wild].icon} ${WILDCARDS[reel.wild].name} added to your bag`);
      return afterPick(i);
    }
    const p = byId(reel.id);
    if (!targetSlots(p).length) { GM.toast(`No open position for ${GM.esc(p.name)} any more`); return; }
    S.pending = S.pending === i ? null : i;
    render();
    if (S.pending != null) {
      const pitch = GM.$('.pitch', root);
      if (pitch && pitch.getBoundingClientRect().bottom < 60) pitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const targetSlots = p => S.xi.map((s, i) => i).filter(i => S.xi[i].p == null && p.poss.includes(S.xi[i].pos));

  function place(slotIdx) {
    if (S.pending == null || S.phase !== 'pick') return;
    const i = S.pending;
    const p = byId(S.reels[i].id);
    const slot = S.xi[slotIdx];
    if (!targetSlots(p).includes(slotIdx)) { GM.toast(`${GM.esc(p.name)} can play ${p.poss.join(' / ')} – pick a highlighted slot`); return; }
    const pos = slot.pos;
    // every signing stores goals/assists/apps; modifiers apply to all three
    let mult = 1, heads = true;
    if (S.modifier === 'captain') mult = 2;
    if (S.modifier === 'rotation') mult = 0.5;
    if (S.modifier === 'coin') {
      heads = GM.rng(`${S.seed}|coin|${S.spin}|${S.respins}`)() < 0.5;
      mult = heads ? 2 : 0;
      if (heads) S.coinWin = true;
      GM.sound.play(heads ? 'good' : 'bad');
      GM.toast(heads ? '🎲 Heads! Doubled' : '🎲 Tails… he counts for nothing', 2600);
    }
    const v = pv(p);
    STAT_KEYS.forEach(k => { v[k] = Math.floor(v[k] * mult); });
    slot.v = v;
    const g = v[S.stat];
    slot.p = p.id; slot.g = g; slot.mod = S.modifier === 'coin' ? (heads ? 'captain' : 'zero') : S.modifier;
    slot.as = pos !== p.poss[0] ? pos : null;
    slot.fresh = true;
    S.modifier = null;
    S.last = p.id;
    S.used.push(p.id);
    S.log.push(pos);
    S.pending = null;
    GM.sound.play('place'); GM.buzz();
    // in target modes a blip climbs as the total closes in on the number
    if (S.target && !S.rules.treble) setTimeout(() => GM.sound.play('rise', S.xi.reduce((a, x) => a + x.g, 0) / S.target), 180);
    afterPick(i);
  }

  async function afterPick(i) {
    // show what everyone on the reels had before moving on
    S.revealed = true;
    S.phase = 'reveal';
    S.selected = i;
    render();
    await GM.sleep(S.reels.some(r => !r.wild) ? 1500 : 700);
    completePick();
  }

  function completePick() {
    S.xi.forEach(s => { s.fresh = false; });
    S.spinRespins = 0;
    S.spin++;
    S.reels = [];
    S.selected = -1;
    S.revealed = false;
    S.special = null;
    if (emptySlots() === 0) return finish();
    S.phase = 'spin';
    render();
  }

  function useWild(k) {
    const w = S.inv[k];
    const wc = WILDCARDS[w];
    if (S.phase === 'spinning' || S.phase === 'reveal' || S.phase === 'done') return;
    const consume = () => { S.inv.splice(k, 1); S.log.push(wc.icon); S.wildUsed++; GM.sound.play('wild'); };
    switch (wc.kind) {
      case 'reveal':
        if (S.phase === 'pick') S.revealed = true; else S.revealNext = true;
        GM.toast(S.phase === 'pick' ? '🔍 Scout report in' : '🔍 Your next spin will be scouted');
        break;
      case 'respin':
        if (S.phase !== 'pick') { GM.toast('Spin first, then Roll Again if you don’t like them'); return; }
        S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(); return;
      case 'special':
        S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(w); return;
      case 'sub':
        if (!S.xi.some(s => s.p != null)) { GM.toast('No one to release yet'); return; }
        S.subbing = k; S.pending = null; render(); GM.toast('Tap a player on the pitch to release him'); return;
      case 'modifier':
        if (S.modifier) { GM.toast('A modifier is already active'); return; }
        S.modifier = w;
        GM.toast(`${wc.icon} ${wc.name} active on your next signing`);
        break;
      case 'formation': {
        const idx = w === 'gegenpress'
          ? WIDE_MIDS.filter(i => ['LM', 'RM'].includes(S.xi[i].pos) && S.xi[i].p == null)
          : [9, 10, 6, 7, 5, 8].filter(i => ['ST', 'CM', 'LM', 'RM'].includes(S.xi[i].pos) && S.xi[i].p == null).slice(0, 2);
        if (!idx.length) { GM.toast(w === 'gegenpress' ? 'Your LM and RM slots are already filled' : 'No free attacking slots to drop back'); return; }
        idx.forEach(i => { S.xi[i].pos = w === 'gegenpress' ? 'ST' : 'CB'; });
        GM.toast(w === 'gegenpress' ? `⚡ Gegenpress! ${idx.length} midfield slot${idx.length > 1 ? 's' : ''} → strikers` : `🚌 Bus parked: ${idx.length} slot${idx.length > 1 ? 's' : ''} → defence`);
        if (S.phase === 'pick' && !S.reels.some(x => x.wild || fits(byId(x.id), openPos()))) { S.respins++; S.spinRespins = (S.spinRespins || 0) + 1; consume(); doSpin(); return; }
        break;
      }
    }
    consume();
    render();
  }

  function release(slotIdx) {
    const s = S.xi[slotIdx];
    if (S.subbing === false || s.p == null) return;
    GM.toast(`👋 ${byId(s.p).name} released`);
    GM.sound.play('swoosh');
    s.p = null; s.g = 0; s.v = null; s.mod = null; s.as = null;
    S.inv.splice(S.subbing, 1);
    S.log.push('🔄');
    S.wildUsed++;
    S.subbing = false;
    render();
  }

  /* ---------------------------------------------------------------- scoring / finish */
  function scoreFor(st) {
    const sum = k => st.xi.reduce((a, s) => a + (s.v ? s.v[k] : (k === st.stat ? s.g : 0)), 0);
    const t = sum(st.stat);
    if (st.rules.max) return { total: t, parts: [], diff: null, t };
    if (st.rules.treble) {
      // up to 333 per stat: full marks when exact, nothing once you're 25% out
      const parts = [], hits = [];
      STAT_KEYS.forEach(k => {
        const got = sum(k), tg = TREBLE[k], e = Math.abs(got - tg) / tg;
        parts.push([`${GM.STATS[k].icon} ${fmt(got)} / ${fmt(tg)} ${GM.STATS[k].label}`, Math.round(333 * Math.max(0, 1 - 4 * e))]);
        if (e <= 0.03) hits.push(k);
      });
      if (hits.length === 3) parts.push(['🏆 THE TREBLE – all three within 3%!', 500]);
      else if (hits.length === 2) parts.push(['🥈 The Double – two within 3%', 150]);
      const worst = Math.max(...STAT_KEYS.map(k => Math.abs(sum(k) - TREBLE[k]) / TREBLE[k]));
      return { total: parts.reduce((a, p) => a + p[1], 0), parts, diff: hits.length === 3 ? 0 : null, t, hits, closeness: Math.round(worst * 500) };
    }
    const diff = Math.abs(st.target - t);
    // closeness is measured in "500-goal units" so every stat/target scores on the same scale
    const d = Math.round(diff * 500 / st.target);
    const parts = [[`Closeness (${fmt(diff)} off)`, Math.max(0, 1000 - 5 * d)]];
    if (diff === 0) parts.push(['🎯 Bullseye!', 500]);
    return { total: parts.reduce((a, p) => a + p[1], 0), parts, diff, t, closeness: d };
  }

  async function finish() {
    S.phase = 'done';
    const sc = scoreFor(S);
    S.final = sc;
    if (S.rules.max && !S.readonly) GM.addDist(distKey(), S.stat, sc.t);  // before the score is saved (see GM.dist)
    const xiSlots = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    if (GM.collectDraft && !S.readonly) {
      const rating = GM.teamRating(xiSlots);
      S.collected = GM.collectDraft({
        mode: S.mode, stat: S.stat, total: sc.t, hard: S.hard, xi: xiSlots.map(s => s.player),
        rating: rating.score, pairs: rating.pairs.length, wildUsed: S.wildUsed, coinWin: S.coinWin,
        bull: sc.diff === 0, closeness: sc.closeness != null ? sc.closeness : null, treble: !!(sc.hits && sc.hits.length === 3),
      });
      S.collected = { n: S.collected.newPlayers.length, total: S.collected.total, badges: S.collected.fresh.map(x => x.icon + ' ' + x.name) };
    }
    if (S.mode === 'daily') {
      GM.store.set('daily2:' + GM.today(), { ...S, rules: undefined });
      GM.store.set(progressKey(), null);
      GM.markDaily('daily', sc.t);
    }
    render();
    GM.sound.play('fulltime');
    const bull = sc.diff === 0;
    if (bull) setTimeout(() => GM.sound.play('horn'), 1700);
    if (!S.readonly) {
      if (S.mode === 'daily' && sc.total > GM.best('daily')) GM.store.set('best:daily', sc.total);
      const { isBest } = await GM.recordScore(modeKey(), sc.total, { t: sc.t });
      if (isBest && sc.total > 0 && S.mode !== 'daily') GM.toast('🏆 New personal best!');
      if (isBest && sc.total > 0 && !bull) setTimeout(() => GM.sound.play('cheer'), 1700);
    }
  }

  /* ---------------------------------------------------------------- rendering */
  const posBadges = GM.posBadges;
  // a small secondary number on the reel card that isn't the stat being played for
  const hintStat = p => S.stat === 'apps' || S.rules.mystery ? '' : `<small>${fmt(p.apps)} apps</small>`;

  function reelInner(x) {
    if (!x) return '';
    if (x.wild) {
      const w = WILDCARDS[x.wild];
      return `<div class="wild-card"><div class="wild-icon">${w.icon}</div><div class="wild-name">${w.name}</div><div class="wild-desc">${w.desc(wst())}</div><div class="tag">WILDCARD</div></div>`;
    }
    const p = byId(x.id);
    const reveal = S.revealed;
    const num = S.rules.treble
      ? `<div class="reel-goals treble-num ${reveal ? 'show' : ''}">${STAT_KEYS.map(k => `<span><b>${reveal ? fmt(pv(p)[k]) : '?'}</b> ${GM.STATS[k].icon}</span>`).join('')}</div>`
      : `<div class="reel-goals ${reveal ? 'show' : ''}">${reveal ? `<b>${fmt(val(p))}</b> ${S.st.label}` : `<b>?</b> ${S.st.label}`}${S.hard ? '' : hintStat(p)}</div>`;
    if (S.hard) {
      return `${GM.avatar(p, 'lg', true)}
      <div class="reel-name">${GM.esc(p.name)}</div>
      <div class="reel-meta">${posBadges(p)}</div>${num}`;
    }
    return `${x.mate ? `<div class="mate" title="Also played for ${GM.esc(x.mate.club)}, like ${GM.esc(x.mate.name)}">🤝 ${GM.clubShort(x.mate.club)} link · ${GM.esc(x.mate.name.split(' ').slice(-1)[0])}</div>` : ''}
      ${GM.avatar(p, 'lg')}
      <div class="reel-name">${GM.esc(p.name)}</div>
      <div class="reel-meta">${posBadges(p)} ${GM.flag(p.nat)} <span>${GM.era(p)}</span></div>
      <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>${num}`;
  }

  const MOD_TAG = { captain: '<i title="Captain – doubled">©</i>', rotation: '<i title="Rotation Risk – halved">🩹</i>', zero: '<i title="Double or Nothing – lost">🎲</i>' };
  function slotHtml(s, i) {
    if (s.p == null) {
      const tgt = S.pending != null && S.reels[S.pending] && targetSlots(byId(S.reels[S.pending].id)).includes(i);
      return `<div class="slot empty ${s.pos !== FORMATION[i] ? 'moved' : ''} ${tgt ? 'target' : ''}" data-slot="${i}" title="${GM.POS_NAME[s.pos]}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span></div>`;
    }
    const p = byId(s.p);
    const surname = p.name.includes(' ') ? p.name.split(' ').slice(1).join(' ') : p.name;
    return `<div class="slot filled ${s.fresh ? 'fresh' : ''}" data-slot="${i}" title="${GM.esc(p.name)}">
      ${GM.avatar(p)}<span class="slot-name">${GM.esc(surname)}</span>
      <span class="slot-goals">${S.rules.treble && s.v ? `${s.v.goals}·${s.v.assists}·${s.v.apps}` : fmt(s.g)}${MOD_TAG[s.mod] || ''}</span><span class="slot-pos" title="${GM.POS_NAME[s.pos]}">${s.pos}</span></div>`;
  }

  function pitchHtml() {
    const lat = i => SIDE[FORMATION[i]] ?? 1;
    const rows = ['F', 'M', 'D', 'G'].map(g => S.xi.map((s, i) => [s, i]).filter(([s]) => GM.GROUP[s.pos] === g)
      .sort((a, b) => lat(a[1]) - lat(b[1]) || a[1] - b[1])).filter(r => r.length);
    const shape = rows.slice(0, -1).reverse().map(r => r.length).join('-');
    return `<div class="pitch ${S.subbing !== false ? 'subbing' : ''} ${S.pending != null ? 'placing' : ''}">
      <div class="pitch-lines"></div><div class="shape">${shape}</div>
      ${rows.map(r => `<div class="pitch-row ${r.length > 4 ? 'crowded' : ''}">${r.map(([s, i]) => slotHtml(s, i)).join('')}</div>`).join('')}
    </div>`;
  }

  function counterHtml() {
    const t = total();
    const left = emptySlots();
    const mod = S.modifier ? ` · <b>${WILDCARDS[S.modifier].icon} ${WILDCARDS[S.modifier].name}</b>` : '';
    if (S.rules.max) {
      const pb = GM.best(S.mode === 'daily' ? 'daily' : modeKey());
      return `<div class="counter max">
      <div class="counter-num"><b>${fmt(t)}</b><span>${S.st.label}</span></div>
      <div class="bar"><i style="width:${pb ? Math.min(100, t / pb * 100) : 0}%"></i></div>
      <div class="counter-sub">${pb ? (t > pb ? '🔥 Beating your best (' + fmt(pb) + ')' : `Your best: ${fmt(pb)}`) : 'Set your first score'} · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
    </div>`;
    }
    if (S.rules.treble) {
      return `<div class="counter treble">${STAT_KEYS.map(k => {
        const got = tot(k), tg = TREBLE[k];
        return `<div class="trow"><span>${GM.STATS[k].icon} <b>${fmt(got)}</b> / ${fmt(tg)} ${GM.STATS[k].label}</span>
          <div class="bar"><i style="width:${Math.min(100, got / tg * 100)}%" class="${got > tg ? 'over' : ''}"></i></div></div>`;
      }).join('')}<div class="counter-sub">${left} slot${left === 1 ? '' : 's'} left${mod}</div></div>`;
    }
    if (S.rules.mystery) {
      const th = thermo(t / S.target);
      return `<div class="counter mystery">
        <div class="counter-num"><b>${fmt(t)}</b><span>${S.st.label} · target ❓</span></div>
        <div class="thermo"><i style="width:${Math.min(100, t / S.target * 80)}%;background:${th.color}"></i></div>
        <div class="counter-sub"><b>${th.icon} ${th.label}</b> · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
      </div>`;
    }
    const over = t > S.target;
    return `<div class="counter ${over ? 'over' : ''}">
      <div class="counter-num"><b>${fmt(t)}</b><span>/ ${fmt(S.target)} ${S.st.label}</span></div>
      <div class="bar"><i style="width:${Math.min(100, t / S.target * 100)}%"></i></div>
      <div class="counter-sub">${over ? `${fmt(t - S.target)} over` : `${fmt(S.target - t)} to go`} · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
    </div>`;
  }

  // Mystery Target temperature, from the fraction of the hidden target you've reached
  function thermo(f) {
    if (f > 1.08) return { icon: '💥', label: 'Overcooked!', color: 'var(--bad)' };
    if (f >= 0.97) return { icon: '🎯', label: 'Scorching!', color: '#ff7a00' };
    if (f >= 0.85) return { icon: '🔥', label: 'Hot', color: '#ffa53b' };
    if (f >= 0.65) return { icon: '♨️', label: 'Warm', color: '#ffd23f' };
    if (f >= 0.4) return { icon: '🌤️', label: 'Getting warmer', color: '#9fd8ff' };
    return { icon: '🥶', label: 'Ice cold', color: '#6cc3ff' };
  }

  function mysteryIntro() {
    // a little slot-machine reveal of which stat counts – the number stays secret
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>🎲 Mystery Target</h2><span></span></div>
      <div class="mystery-intro"><p>Tonight we’re counting…</p><div class="mystery-roll" id="mroll">⚽ Goals</div>
      <p class="muted" id="mnote">The target number is secret until full time. A thermometer tells you how warm you are.</p>
      <button class="btn big" id="mgo" hidden>Kick off</button></div>`;
    const el = GM.$('#mroll', root), labels = STAT_KEYS.map(k => `${GM.STATS[k].icon} ${GM.STATS[k].name}`);
    let i = 0;
    const iv = setInterval(() => { el.textContent = labels[i++ % 3]; GM.sound.play('tick'); }, 90);
    setTimeout(() => {
      clearInterval(iv);
      GM.sound.play('land');
      el.textContent = `${S.st.icon} ${S.st.name}`;
      el.classList.add('landed');
      const range = MYSTERY[S.stat];
      GM.$('#mnote', root).innerHTML = `Somewhere between <b>${fmt(range[0])}</b> and <b>${fmt(range[1])}</b> ${S.st.label}. The exact number is secret until full time – watch the thermometer.`;
      const go = GM.$('#mgo', root); go.hidden = false;
      go.onclick = () => { S.revealStage = null; render(); };
    }, 1400);
  }

  function render() {
    if (!S) return;
    if (S.phase === 'done') return renderDone();
    if (S.mode === 'daily' && !S.readonly) GM.store.set(progressKey(), { ...S, rules: undefined });
    if (S.revealStage === 'intro') return mysteryIntro();
    const icon = S.mode === 'club' ? '🏟️' : GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const nReels = Math.max(3, S.reels.length);
    const sp = S.special && WILDCARDS[S.special];
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} ${modeName()}${S.hard ? ' · Hard' : ''}</h2><button class="icon-btn" id="help">?</button></div>
      ${S.vs ? `<div class="banner">⚔️ Beat <b>${GM.esc(S.vs)}</b>’s score of <b>${GM.esc(S.vss)}</b></div>` : ''}
      ${counterHtml()}
      ${pitchHtml()}
      <div class="inv"><span class="inv-label">Wildcards ${S.inv.length}/3</span>${S.inv.length ? S.inv.map((w, k) =>
      `<button class="wild-btn ${S.subbing === k ? 'active' : ''}" data-w="${k}" title="${GM.esc(WILDCARDS[w].desc(wst()))}">${WILDCARDS[w].icon}<small>${WILDCARDS[w].name}</small></button>`).join('')
        : '<span class="muted">none yet · they turn up on the reels</span>'}${S.subbing !== false ? '<button class="btn small ghost" id="cancel-sub">Cancel</button>' : ''}</div>
      ${sp && S.phase !== 'spin' ? `<div class="special-banner">${sp.icon} ${sp.name}</div>` : ''}
      ${S.phase === 'spin' ? `<div class="spin-zone"><button class="btn big spin" id="spin">🎰 SPIN</button></div>` : `<div class="reels">${Array.from({ length: nReels }, (_, i) => {
          const x = S.reels[i];
          if (S.phase === 'spinning') return `<div class="reel spinning"><div class="reel-spin">…</div></div>`;
          if (!x) return `<div class="reel idle"><div class="reel-q">?</div></div>`;
          return `<button class="reel ${x.wild ? 'is-wild' : ''} ${S.selected === i || S.pending === i ? 'selected' : ''} ${S.phase === 'reveal' && S.selected !== i ? 'dim' : ''} ${S.hard ? 'hard' : ''}" data-reel="${i}">${reelInner(x)}</button>`;
        }).join('')}</div>`}
      <div class="actions">
        ${S.phase === 'pick' && S.pending == null ? `<div class="hint">Tap a player, then tap the slot he’ll play in${S.reels.some(r => r.wild) ? ' – or grab the wildcard' : ''}</div>` : ''}
        ${S.phase === 'pick' && S.pending != null ? `<div class="hint">📍 Now tap a highlighted slot on the pitch for <b>${GM.esc(byId(S.reels[S.pending].id).name)}</b> (${byId(S.reels[S.pending].id).poss.join(' / ')})</div>` : ''}
      </div>`;
    GM.$('#help', root).onclick = help;
    const spb = GM.$('#spin', root); if (spb) spb.onclick = () => doSpin();
    GM.$$('[data-reel]', root).forEach(b => b.onclick = () => sign(+b.dataset.reel));
    GM.$$('[data-w]', root).forEach(b => b.onclick = () => useWild(+b.dataset.w));
    GM.$$('[data-slot]', root).forEach(b => b.onclick = () => {
      if (S.subbing !== false) release(+b.dataset.slot);
      else if (S.pending != null) place(+b.dataset.slot);
    });
    const cs = GM.$('#cancel-sub', root); if (cs) cs.onclick = () => { S.subbing = false; render(); };
  }

  function help() {
    const r = S.rules, L = S.st.label;
    GM.modal(`<h3>How to play</h3>
      ${r.treble ? `<p>🏆 <b>The Treble:</b> one XI, three targets – <b>${fmt(TREBLE.goals)} goals</b>, <b>${fmt(TREBLE.assists)} assists</b> and <b>${fmt(TREBLE.apps)} appearances</b>. Strikers bring goals, creators bring assists, old warhorses bring apps: balance them.</p>`
      : r.mystery ? `<p>🎲 <b>Mystery Target:</b> you’re counting <b>${S.st.label}</b>, but the target is secret – somewhere between ${fmt(MYSTERY[S.stat][0])} and ${fmt(MYSTERY[S.stat][1])}. The thermometer tells you how close you are. It’s revealed at full time.</p>`
      : r.max ? `<p>👑 <b>${modeName()}:</b> no target – build the XI with the <b>most Premier League ${L}</b> you can. Every player with 50+ apps is equally likely to turn up, so you’ll mostly see journeymen: spot the big numbers and use your wildcards well.</p>`
      : `<p>🎯 <b>${modeName()}:</b> build an XI whose players have <b>${fmt(S.target)}</b> Premier League ${L} between them – as close as you can, exactly for a bullseye.</p>`}
      <p>Each spin shows three players who fit an open position. Their ${L} are hidden until you sign one. You keep spinning until the XI is full.</p>
      <p>Every player has real positions – <b>GK, LB, CB, RB, LM, CM, RM, ST</b>. Tap a player, then tap one of the highlighted slots he can play.</p>
      <p><b>Wildcards</b> appear on the reels from the 2nd spin – grab one instead of a player and use it when you like (hold up to 3):</p>
      <ul class="wc-list">${Object.entries(WILDCARDS).filter(([k]) => !r.noWild.includes(k)).map(([, w]) => `<li>${w.icon} <b>${w.name}</b> – ${w.desc(wst())}</li>`).join('')}</ul>
      <p><b>Scoring:</b> ${r.treble ? 'up to 333 points per stat (full marks when exact, nothing once you’re 25% out). All three within 3% wins the Treble: +500. Two = the Double: +150.'
        : r.mystery ? '1000 minus 5 points per 1% you miss by (roughly). Hit it exactly for a +500 bullseye.'
        : r.max ? `your score is your XI’s total PL ${L} (after any wildcard modifiers).` : `1000 minus 5 for every ${S.stat === 'goals' ? 'goal' : `${fmt(Math.round(S.target / 442 * 10) / 10)} ${L}`} off target. Exactly ${fmt(S.target)} = +500 bullseye bonus.`}</p>
      <p>🤝 A player who shares a club with your last signing may turn up to tempt you.</p>
      ${S.hard ? `<p>🥵 <b>Hard mode:</b> just names and positions – no clubs, years, apps or nationality${r.max ? '' : ', and far fewer star players on the reels (same targets)'}. Separate leaderboard.</p>` : ''}
      <div class="row"><button class="btn" data-close>Got it</button></div>`);
  }

  function renderDone() {
    const sc = S.final || scoreFor(S);
    const best = GM.best(S.mode === 'daily' ? 'daily' : modeKey());
    const icon = S.mode === 'club' ? '🏟️' : GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const xi = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} Full time</h2><span></span></div>
      <div class="result">
        ${S.rules.mystery ? `<div class="mystery-reveal">🎲 The mystery target was <b>${fmt(S.target)}</b> ${S.st.label}</div>` : ''}
        ${S.rules.treble ? `<div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${sc.hits.length === 3 ? '🏆' : sc.hits.length === 2 ? '🥈' : ''}${fmt(sc.t)}<small>goals · ${fmt(tot('assists'))} assists · ${fmt(tot('apps'))} apps</small></div>`
        : `<div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${fmt(sc.t)}<small>PL ${S.st.label}${S.rules.max ? '' : ` · target ${fmt(S.target)}`}</small></div>`}
        ${S.rules.max ? '' : `<div class="result-score">${sc.total}<small>points</small></div>
        <table class="breakdown">${sc.parts.map(([k, v]) => `<tr><td>${k}</td><td>+${v}</td></tr>`).join('')}</table>`}
        ${S.vs ? `<div class="banner">${sc.total > S.vss ? '🎉 You beat' : sc.total == S.vss ? '🤝 You drew with' : '😬 You lost to'} <b>${GM.esc(S.vs)}</b> (${GM.esc(S.vss)})</div>` : ''}
        <div class="muted">Personal best: ${fmt(Math.max(best, sc.total))}</div>
      </div>
      ${S.rules.max ? GM.distHtml(distKey(), S.stat, sc.t) : ''}
      ${S.collected ? `<a class="collected" href="#/album">📒 ${S.collected.n ? `<b>+${S.collected.n}</b> new player${S.collected.n === 1 ? '' : 's'} for your album` : 'No new players this time'} · ${S.collected.total.toLocaleString()} collected${S.collected.badges.length ? `<br>🏅 ${S.collected.badges.join(' · ')}` : ''} ›</a>` : ''}
      ${GM.report ? GM.report(xi, S.st, S.rules.treble) : ''}
      ${pitchHtml()}
      <div class="actions col">
        ${S.mode !== 'daily' ? `<button class="btn big" id="again">🔁 Play again</button>` : `<div class="muted">New Daily Ultimate tomorrow</div>`}
        <button class="btn" id="challenge">⚔️ Challenge a friend (same spins)</button>
        <button class="btn ghost" id="share">📤 Share result</button>
        <a class="btn ghost" href="#/leaderboard?m=${encodeURIComponent(modeKey())}">🏆 Leaderboard</a>
      </div>`;
    const again = GM.$('#again', root); if (again) again.onclick = () => start(root, S.mode, { hard: S.hard, stat: S.rules.mystery ? undefined : S.stat, club: S.club });
    GM.$('#share', root).onclick = () => GM.share(resultText(sc));
    GM.$('#challenge', root).onclick = async () => {
      const name = await GM.askName() || 'A friend';
      const m = S.mode === 'daily' ? 'ultimate' : S.mode;
      const url = `${GM.baseUrl()}#/draft?m=${m}&s=${S.stat}${S.club ? '&c=' + encodeURIComponent(S.club) : ''}&seed=${encodeURIComponent(S.seed)}${S.hard ? '&h=1' : ''}&vs=${encodeURIComponent(name)}&vss=${sc.total}`;
      GM.share(S.rules.max
        ? `⚽ Goal Machine – my ${modeName()}${S.hard ? ' (Hard)' : ''} XI has ${fmt(sc.t)} PL ${S.st.label}. Same spins, can you beat it?`
        : S.rules.treble || S.rules.mystery ? `⚽ Goal Machine – I scored ${sc.total} in ${modeName()}${S.hard ? ' (Hard)' : ''}. Same spins, can you beat me?`
        : `⚽ Goal Machine – I scored ${sc.total} in ${modeName()}${S.hard ? ' (Hard)' : ''} (${fmt(sc.t)}/${fmt(S.target)}). Same spins, can you beat me?`, url);
    };
  }

  function resultText(sc) {
    const icons = S.log.map(l => ({ G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[GM.GROUP[l]] || l)).join('');
    const head = S.mode === 'daily' ? `Daily Ultimate · ${GM.today()}` : modeName() + (S.hard ? ' (Hard)' : '');
    const rating = GM.teamRating ? GM.teamRating(S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }))) : null;
    const tier = rating ? `\n${rating.tier.icon} ${rating.tier.name}` : '';
    if (S.rules.max) return `⚽ Goal Machine – ${head}\n👑 ${fmt(sc.t)} PL ${S.st.label}${tier}\n${icons}`;
    if (S.rules.treble) return `⚽ Goal Machine – ${head}\n${STAT_KEYS.map(k => `${GM.STATS[k].icon} ${fmt(tot(k))}/${fmt(TREBLE[k])}`).join(' ')}${sc.hits.length === 3 ? ' 🏆 TREBLE!' : ''}\n${sc.total} pts${tier}\n${icons}`;
    if (S.rules.mystery) return `⚽ Goal Machine – ${head}\n🎲 ${fmt(sc.t)} ${S.st.label} vs a secret ${fmt(S.target)}${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts${tier}\n${icons}`;
    return `⚽ Goal Machine – ${head}\n${fmt(sc.t)}/${fmt(S.target)} ${S.st.label}${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts${tier}\n${icons}`;
  }
})();
