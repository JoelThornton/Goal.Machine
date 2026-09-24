/* Goal Machine – the XI draft: Ultimate Wildcard (most goals/assists/apps), Target (hit a number) and the Daily */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SIDE = { LB: 0, LM: 0, RB: 2, RM: 2 }; // for left-to-right ordering on the pitch
  const WIDE_MIDS = [5, 8];
  // Target mode numbers: 442 is the classic; the others were set so they're about as hard to hit (simulated)
  const TARGETS = { goals: 442, assists: 333, apps: 3500 };
  // "big number" filter for the Centurion Throw, per stat
  const BIG = { goals: 100, assists: 50, apps: 400 };

  // kind: 'reveal' | 'respin' | 'special' (themed spin) | 'formation' | 'modifier' | 'sub'
  const WILDCARDS = {
    scout: { icon: '🔍', name: "Scout's IQ", w: 3, kind: 'reveal', desc: st => `See the PL ${st.label} of the players on the reels this turn.` },
    respin: { icon: '🎰', name: 'Roll Again', w: 3, kind: 'respin', desc: () => 'Throw these back and spin again – free.' },
    sub: { icon: '🔄', name: 'Make a Sub', w: 2, kind: 'sub', desc: st => `Release a player from your XI. His ${st.label} come off.` },
    centurion: { icon: '💯', name: 'Centurion Throw', w: 1.5, kind: 'special', desc: st => `A free spin of players with ${BIG[st.id]}+ PL ${st.label}.`, filter: (p, st) => p[st.key] >= BIG[st.id] },
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
  };
  RULES.daily = RULES.ultimate;

  let S = null; // game state
  let root = null;

  GM.draft = { start, RULES, WILDCARDS, TARGETS, state: () => S, render: () => render(), modeKey: (m, s, h) => keyFor(m, s, h) };

  const statSuffix = s => ({ goals: '', assists: 'ast', apps: 'apps' }[s]);
  function keyFor(mode, stat, hard) { return mode === 'daily' ? 'daily:' + GM.today() : mode + statSuffix(stat) + (hard ? 'h' : ''); }

  function start(el, mode, opts = {}) {
    root = el;
    if (!RULES[mode]) mode = 'ultimate';
    const stat = mode === 'daily' ? 'goals' : (GM.STATS[opts.stat] ? opts.stat : 'goals');
    const seed = mode === 'daily' ? 'daily:' + GM.today() : (opts.seed || GM.newSeed());
    if (mode === 'daily') {
      const done = GM.store.get('daily2:' + GM.today());
      if (done && done.xi) { S = done; S.rules = RULES.daily; S.phase = 'done'; S.readonly = true; render(); return; }
    }
    S = {
      mode, stat, seed, rules: RULES[mode], st: { ...GM.STATS[stat], id: stat },
      target: RULES[mode].max ? null : TARGETS[stat], spin: 0, respins: 0,
      xi: FORMATION.map(pos => ({ pos, p: null, g: 0, mod: null, as: null })),
      reels: [], selected: -1, revealed: false, revealNext: false, special: null,
      inv: [], modifier: null, subbing: false, used: [], last: null,
      phase: 'spin', vs: opts.vs, vss: opts.vss, log: [], pending: null, wildUsed: 0, coinWin: false,
      hard: mode !== 'daily' && !!opts.hard,
    };
    render();
  }

  const modeKey = () => keyFor(S.mode, S.stat, S.hard);
  const modeName = () => GM.MODES[S.mode === 'daily' ? 'daily' : S.mode + statSuffix(S.stat)].name;
  const val = p => p[S.st.key];
  const total = () => S.xi.reduce((t, s) => t + s.g, 0);
  const openPos = () => [...new Set(S.xi.filter(s => s.p == null).map(s => s.pos))];
  const byId = id => GM.players[id];
  const fits = (p, open) => p.poss.some(x => open.includes(x));
  const emptySlots = () => S.xi.filter(s => s.p == null).length;
  const fmt = n => n.toLocaleString();

  /* ---------------------------------------------------------------- reel generation */
  function makeReels(special) {
    const r = GM.rng(`${S.seed}|${S.stat}|${S.spin}|${S.respins}|${special || ''}`);
    const open = openPos();
    const used = new Set(S.used.concat(S.xi.filter(s => s.p != null).map(s => s.p)));
    const pool = GM.players.filter(p => fits(p, open) && !used.has(p.id));
    const wc = special && WILDCARDS[special];
    const n = (wc && wc.reels) || 3;
    const reels = [];
    let wildShown = !!special;
    for (let i = 0; i < n; i++) {
      if (S.spin >= 1 && !wildShown && i < 2 && r() < 0.28) {
        const types = Object.keys(WILDCARDS).filter(t => !S.rules.noWild.includes(t));
        reels.push({ wild: r.weighted(types, t => WILDCARDS[t].w) });
        wildShown = true;
        continue;
      }
      const taken = new Set(reels.filter(x => x.id != null).map(x => x.id));
      let cands = pool.filter(p => !taken.has(p.id));
      let mate = null;
      if (wc && wc.filter) {
        const themed = cands.filter(p => wc.filter(p, S.st));
        if (themed.length) cands = themed;
      } else if (i === 1 && S.last != null && r() < 0.35) {
        const lp = byId(S.last);
        const mates = cands.filter(p => p.first <= lp.last && p.last >= lp.first && p.clubs.some(c => lp.clubs.includes(c)));
        if (mates.length) { cands = mates; mate = lp; }
      }
      if (!cands.length) break;
      const p = r.weighted(cands, S.rules.weight);
      const x = { id: p.id };
      if (mate) x.mate = { name: mate.name, club: p.clubs.find(c => mate.clubs.includes(c)) };
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
    await new Promise(res => {
      const tick = () => {
        const t = performance.now() - t0;
        let running = false;
        cards.forEach((c, i) => {
          if (t < stops[i]) {
            running = true;
            const n = c.querySelector('.reel-spin');
            if (n) n.textContent = names[Math.floor(Math.random() * names.length)].name;
          } else if (c.classList.contains('spinning')) {
            c.classList.remove('spinning');
            c.innerHTML = reelInner(S.reels[i]);
            c.classList.add('landed');
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
    let g = val(p);
    if (S.modifier === 'captain') g *= 2;
    if (S.modifier === 'rotation') g = Math.floor(g / 2);
    if (S.modifier === 'coin') {
      const heads = GM.rng(`${S.seed}|coin|${S.spin}|${S.respins}`)() < 0.5;
      g = heads ? g * 2 : 0;
      if (heads) S.coinWin = true;
      GM.toast(heads ? `🎲 Heads! ${S.st.name} doubled` : `🎲 Tails… his ${S.st.label} count for nothing`, 2600);
    }
    slot.p = p.id; slot.g = g; slot.mod = S.modifier === 'coin' ? (g ? 'captain' : 'zero') : S.modifier;
    slot.as = pos !== p.poss[0] ? pos : null;
    slot.fresh = true;
    S.modifier = null;
    S.last = p.id;
    S.used.push(p.id);
    S.log.push(pos);
    S.pending = null;
    afterPick(i);
  }

  async function afterPick(i) {
    // show what everyone on the reels had before moving on
    S.revealed = true;
    S.phase = 'reveal';
    S.selected = i;
    render();
    await GM.sleep(S.reels.some(r => !r.wild) ? 1500 : 700);
    S.xi.forEach(s => { s.fresh = false; });
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
    const consume = () => { S.inv.splice(k, 1); S.log.push(wc.icon); S.wildUsed++; };
    switch (wc.kind) {
      case 'reveal':
        if (S.phase === 'pick') S.revealed = true; else S.revealNext = true;
        GM.toast(S.phase === 'pick' ? '🔍 Scout report in' : '🔍 Your next spin will be scouted');
        break;
      case 'respin':
        if (S.phase !== 'pick') { GM.toast('Spin first, then Roll Again if you don’t like them'); return; }
        S.respins++; consume(); doSpin(); return;
      case 'special':
        S.respins++; consume(); doSpin(w); return;
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
        if (S.phase === 'pick' && !S.reels.some(x => x.wild || fits(byId(x.id), openPos()))) { S.respins++; consume(); doSpin(); return; }
        break;
      }
    }
    consume();
    render();
  }

  function release(slotIdx) {
    const s = S.xi[slotIdx];
    if (S.subbing === false || s.p == null) return;
    GM.toast(`👋 ${byId(s.p).name} released (−${fmt(s.g)})`);
    s.p = null; s.g = 0; s.mod = null; s.as = null;
    S.inv.splice(S.subbing, 1);
    S.log.push('🔄');
    S.wildUsed++;
    S.subbing = false;
    render();
  }

  /* ---------------------------------------------------------------- scoring / finish */
  function scoreFor(st) {
    const t = st.xi.reduce((a, s) => a + s.g, 0);
    if (st.rules.max) return { total: t, parts: [], diff: null, t };
    const diff = Math.abs(st.target - t);
    // closeness is measured in "442-goal units" so apps/assists targets score on the same scale
    const d = Math.round(diff * 442 / st.target);
    const parts = [[`Closeness (${fmt(diff)} off)`, Math.max(0, 1000 - 5 * d)]];
    if (diff === 0) parts.push(['🎯 Bullseye!', 500]);
    return { total: parts.reduce((a, p) => a + p[1], 0), parts, diff, t };
  }

  async function finish() {
    S.phase = 'done';
    const sc = scoreFor(S);
    S.final = sc;
    const xiSlots = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    if (GM.collectDraft && !S.readonly) {
      const rating = GM.teamRating(xiSlots);
      S.collected = GM.collectDraft({
        mode: S.mode, stat: S.stat, total: sc.t, hard: S.hard, xi: xiSlots.map(s => s.player),
        rating: rating.score, pairs: rating.pairs.length, wildUsed: S.wildUsed, coinWin: S.coinWin,
        bull: sc.diff === 0, closeness: S.target ? Math.round(sc.diff * 442 / S.target) : null,
      });
      S.collected = { n: S.collected.newPlayers.length, total: S.collected.total, badges: S.collected.fresh.map(x => x.icon + ' ' + x.name) };
    }
    if (S.mode === 'daily') GM.store.set('daily2:' + GM.today(), { ...S, rules: undefined });
    render();
    if (!S.readonly) {
      if (S.mode === 'daily' && sc.total > GM.best('daily')) GM.store.set('best:daily', sc.total);
      const { isBest } = await GM.recordScore(modeKey(), sc.total, { t: sc.t });
      if (isBest && sc.total > 0 && S.mode !== 'daily') GM.toast('🏆 New personal best!');
    }
  }

  /* ---------------------------------------------------------------- rendering */
  const posBadges = GM.posBadges;
  // a small secondary number on the reel card that isn't the stat being played for
  const hintStat = p => S.stat === 'apps' ? '' : `<small>${fmt(p.apps)} apps</small>`;

  function reelInner(x) {
    if (!x) return '';
    if (x.wild) {
      const w = WILDCARDS[x.wild];
      return `<div class="wild-card"><div class="wild-icon">${w.icon}</div><div class="wild-name">${w.name}</div><div class="wild-desc">${w.desc(S.st)}</div><div class="tag">WILDCARD</div></div>`;
    }
    const p = byId(x.id);
    const reveal = S.revealed;
    const num = `<div class="reel-goals ${reveal ? 'show' : ''}">${reveal ? `<b>${fmt(val(p))}</b> ${S.st.label}` : `<b>?</b> ${S.st.label}`}${S.hard ? '' : hintStat(p)}</div>`;
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
      <span class="slot-goals">${fmt(s.g)}${MOD_TAG[s.mod] || ''}</span><span class="slot-pos" title="${GM.POS_NAME[s.pos]}">${s.pos}</span></div>`;
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
    const over = t > S.target;
    return `<div class="counter ${over ? 'over' : ''}">
      <div class="counter-num"><b>${fmt(t)}</b><span>/ ${fmt(S.target)} ${S.st.label}</span></div>
      <div class="bar"><i style="width:${Math.min(100, t / S.target * 100)}%"></i></div>
      <div class="counter-sub">${over ? `${fmt(t - S.target)} over` : `${fmt(S.target - t)} to go`} · ${left} slot${left === 1 ? '' : 's'} left${mod}</div>
    </div>`;
  }

  function render() {
    if (!S) return;
    if (S.phase === 'done') return renderDone();
    const icon = GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const nReels = Math.max(3, S.reels.length);
    const sp = S.special && WILDCARDS[S.special];
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} ${modeName()}${S.hard ? ' · Hard' : ''}</h2><button class="icon-btn" id="help">?</button></div>
      ${S.vs ? `<div class="banner">⚔️ Beat <b>${GM.esc(S.vs)}</b>’s score of <b>${GM.esc(S.vss)}</b></div>` : ''}
      ${counterHtml()}
      ${pitchHtml()}
      <div class="inv"><span class="inv-label">Wildcards ${S.inv.length}/3</span>${S.inv.length ? S.inv.map((w, k) =>
      `<button class="wild-btn ${S.subbing === k ? 'active' : ''}" data-w="${k}" title="${GM.esc(WILDCARDS[w].desc(S.st))}">${WILDCARDS[w].icon}<small>${WILDCARDS[w].name}</small></button>`).join('')
        : '<span class="muted">none yet – they appear on the reels</span>'}${S.subbing !== false ? '<button class="btn small ghost" id="cancel-sub">Cancel</button>' : ''}</div>
      ${sp && S.phase !== 'spin' ? `<div class="special-banner">${sp.icon} ${sp.name}</div>` : ''}
      <div class="reels">${Array.from({ length: nReels }, (_, i) => {
          const x = S.reels[i];
          if (S.phase === 'spinning') return `<div class="reel spinning"><div class="reel-spin">…</div></div>`;
          if (!x) return `<div class="reel idle"><div class="reel-q">?</div></div>`;
          return `<button class="reel ${x.wild ? 'is-wild' : ''} ${S.selected === i || S.pending === i ? 'selected' : ''} ${S.phase === 'reveal' && S.selected !== i ? 'dim' : ''} ${S.hard ? 'hard' : ''}" data-reel="${i}">${reelInner(x)}</button>`;
        }).join('')}</div>
      <div class="actions">
        ${S.phase === 'spin' ? `<button class="btn big spin" id="spin">🎰 SPIN</button>` : ''}
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
      ${r.max ? `<p>👑 <b>${modeName()}:</b> no target – build the XI with the <b>most Premier League ${L}</b> you can. Every player with 50+ apps is equally likely to turn up, so you’ll mostly see journeymen: spot the big numbers and use your wildcards well.</p>`
      : `<p>🎯 <b>${modeName()}:</b> build an XI whose players have <b>${fmt(S.target)}</b> Premier League ${L} between them – as close as you can, exactly for a bullseye.</p>`}
      <p>Each spin shows three players who fit an open position. Their ${L} are hidden until you sign one. You keep spinning until the XI is full.</p>
      <p>Every player has real positions – <b>GK, LB, CB, RB, LM, CM, RM, ST</b>. Tap a player, then tap one of the highlighted slots he can play.</p>
      <p><b>Wildcards</b> appear on the reels from the 2nd spin – grab one instead of a player and use it when you like (hold up to 3):</p>
      <ul class="wc-list">${Object.entries(WILDCARDS).filter(([k]) => !r.noWild.includes(k)).map(([, w]) => `<li>${w.icon} <b>${w.name}</b> – ${w.desc(S.st)}</li>`).join('')}</ul>
      <p><b>Scoring:</b> ${r.max ? `your score is your XI’s total PL ${L} (after any wildcard modifiers).` : `1000 minus 5 for every ${S.stat === 'goals' ? 'goal' : `${fmt(Math.round(S.target / 442 * 10) / 10)} ${L}`} off target. Exactly ${fmt(S.target)} = +500 bullseye bonus.`}</p>
      <p>🤝 A player who shares a club with your last signing may turn up to tempt you.</p>
      ${S.hard ? '<p>🥵 <b>Hard mode:</b> just names and positions – no clubs, years, apps or nationality. Separate leaderboard.</p>' : ''}
      <div class="row"><button class="btn" data-close>Got it</button></div>`);
  }

  function renderDone() {
    const sc = S.final || scoreFor(S);
    const best = GM.best(S.mode === 'daily' ? 'daily' : modeKey());
    const icon = GM.MODES[S.mode === 'daily' ? 'daily' : S.mode].icon;
    const xi = S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }));
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} Full time</h2><span></span></div>
      <div class="result">
        <div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${fmt(sc.t)}<small>PL ${S.st.label}${S.rules.max ? '' : ` · target ${fmt(S.target)}`}</small></div>
        ${S.rules.max ? '' : `<div class="result-score">${sc.total}<small>points</small></div>
        <table class="breakdown">${sc.parts.map(([k, v]) => `<tr><td>${k}</td><td>+${v}</td></tr>`).join('')}</table>`}
        ${S.vs ? `<div class="banner">${sc.total > S.vss ? '🎉 You beat' : sc.total == S.vss ? '🤝 You drew with' : '😬 You lost to'} <b>${GM.esc(S.vs)}</b> (${GM.esc(S.vss)})</div>` : ''}
        <div class="muted">Personal best: ${fmt(Math.max(best, sc.total))}</div>
      </div>
      ${S.collected ? `<a class="collected" href="#/album">📒 ${S.collected.n ? `<b>+${S.collected.n}</b> new player${S.collected.n === 1 ? '' : 's'} for your album` : 'No new players this time'} · ${S.collected.total.toLocaleString()} collected${S.collected.badges.length ? `<br>🏅 ${S.collected.badges.join(' · ')}` : ''} ›</a>` : ''}
      ${GM.report ? GM.report(xi, S.st) : ''}
      ${pitchHtml()}
      <div class="actions col">
        ${S.mode !== 'daily' ? `<button class="btn big" id="again">🔁 Play again</button>` : `<div class="muted">New Daily Ultimate tomorrow</div>`}
        <button class="btn" id="challenge">⚔️ Challenge a friend (same spins)</button>
        <button class="btn ghost" id="share">📤 Share result</button>
        <a class="btn ghost" href="#/leaderboard?m=${encodeURIComponent(modeKey())}">🏆 Leaderboard</a>
      </div>`;
    const again = GM.$('#again', root); if (again) again.onclick = () => start(root, S.mode, { hard: S.hard, stat: S.stat });
    GM.$('#share', root).onclick = () => GM.share(resultText(sc));
    GM.$('#challenge', root).onclick = async () => {
      const name = await GM.askName() || 'A friend';
      const m = S.mode === 'daily' ? 'ultimate' : S.mode;
      const url = `${GM.baseUrl()}#/draft?m=${m}&s=${S.stat}&seed=${encodeURIComponent(S.seed)}${S.hard ? '&h=1' : ''}&vs=${encodeURIComponent(name)}&vss=${sc.total}`;
      GM.share(S.rules.max
        ? `⚽ Goal Machine – my ${modeName()}${S.hard ? ' (Hard)' : ''} XI has ${fmt(sc.t)} PL ${S.st.label}. Same spins, can you beat it?`
        : `⚽ Goal Machine – I scored ${sc.total} in ${modeName()}${S.hard ? ' (Hard)' : ''} (${fmt(sc.t)}/${fmt(S.target)}). Same spins, can you beat me?`, url);
    };
  }

  function resultText(sc) {
    const icons = S.log.map(l => ({ G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[GM.GROUP[l]] || l)).join('');
    const head = S.mode === 'daily' ? `Daily Ultimate · ${GM.today()}` : modeName() + (S.hard ? ' (Hard)' : '');
    const rating = GM.teamRating ? GM.teamRating(S.xi.filter(s => s.p != null).map(s => ({ ...s, player: byId(s.p) }))) : null;
    const tier = rating ? `\n${rating.tier.icon} ${rating.tier.name}` : '';
    if (S.rules.max) return `⚽ Goal Machine – ${head}\n👑 ${fmt(sc.t)} PL ${S.st.label}${tier}\n${icons}`;
    return `⚽ Goal Machine – ${head}\n${fmt(sc.t)}/${fmt(S.target)} ${S.st.label}${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts${tier}\n${icons}`;
  }
})();
