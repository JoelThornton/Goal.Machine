/* Goal Machine – the 442 draft game (Classic / Wildcard / Hardcore / Deep Cuts / Daily) */
'use strict';

(function () {
  const FORMATION = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
  const SIDE = { LB: 0, LM: 0, RB: 2, RM: 2 }; // for left-to-right ordering on the pitch
  const WIDE_MIDS = [5, 8];
  const SPIN_BUDGET = 16; // wildcard modes: 11 signings + 5 spare spins to spend on grabbing wildcards
  const UNUSED_BONUS = 50;

  // kind: 'reveal' | 'respin' | 'special' (themed spin) | 'formation' | 'modifier' | 'sub'
  const WILDCARDS = {
    scout: { icon: '🔍', name: "Scout's IQ", w: 3, kind: 'reveal', desc: 'See the PL goal tallies of the players on the reels this turn.' },
    respin: { icon: '🎰', name: 'Roll Again', w: 3, kind: 'respin', desc: 'Throw these back and spin again – free.' },
    sub: { icon: '🔄', name: 'Make a Sub', w: 2, kind: 'sub', desc: 'Release a player from your XI. His goals come off.' },
    centurion: { icon: '💯', name: 'Centurion Throw', w: 1.5, kind: 'special', desc: 'A free spin of three players with 100+ PL goals.', filter: p => p.goals >= 100 },
    gegenpress: { icon: '⚡', name: 'Gegenpress', w: 1.5, kind: 'formation', desc: 'Your empty LM and RM slots push up and become strikers.' },
    bus: { icon: '🚌', name: 'Park the Bus', w: 1.5, kind: 'formation', desc: 'Two empty attacking slots drop back to centre-back.' },
    captain: { icon: '©️', name: "Captain's Armband", w: 1.5, kind: 'modifier', desc: 'Your next signing’s goals count double.' },
    rotation: { icon: '🩹', name: 'Rotation Risk', w: 1.5, kind: 'modifier', desc: 'Your next signing’s goals count half (rounded down).' },
    coin: { icon: '🎲', name: 'Double or Nothing', w: 1, kind: 'modifier', desc: 'Coin toss on your next signing: his goals count ×2… or ×0.' },
    deadline: { icon: '⏰', name: 'Deadline Day', w: 1.5, kind: 'special', desc: 'A free spin with FIVE players to choose from.', reels: 5 },
    oneclub: { icon: '❤️', name: 'One-Club Man', w: 1, kind: 'special', desc: 'A free spin of players who only played for one PL club.', filter: p => p.clubs.length === 1 },
    journeyman: { icon: '🧳', name: 'Journeyman', w: 1, kind: 'special', desc: 'A free spin of players who turned out for 4+ PL clubs.', filter: p => p.clubs.length >= 4 },
    throwback: { icon: '📼', name: '90s Throwback', w: 1, kind: 'special', desc: 'A free spin of players whose PL career began in the 1990s.', filter: p => p.first <= 1999 },
  };

  const RULES = {
    classic: { target: 442, wild: false, bust: false, weight: p => p.fame },
    wild: { target: 442, wild: true, bust: false, weight: p => p.fame },
    hardcore: { target: 442, wild: false, bust: true, weight: p => p.fame },
    deep: { target: 200, wild: false, bust: false, weight: () => 1 },
    daily: { target: 442, wild: true, bust: false, weight: p => p.fame },
  };

  let S = null; // game state
  let root = null;

  GM.draft = { start, score: scoreFor, RULES, WILDCARDS, state: () => S, render: () => render() };

  function start(el, mode, opts = {}) {
    root = el;
    const rules = RULES[mode];
    const seed = mode === 'daily' ? 'daily:' + GM.today() : (opts.seed || GM.newSeed());
    if (mode === 'daily') {
      const done = GM.store.get('daily:' + GM.today());
      if (done && done.xi) { S = done; S.phase = 'done'; S.readonly = true; render(); return; }
    }
    S = {
      mode, seed, rules, target: rules.target, spin: 0, respins: 0,
      spinsLeft: rules.wild ? SPIN_BUDGET : null,
      xi: FORMATION.map(pos => ({ pos, p: null, g: 0, mod: null, as: null })),
      reels: [], selected: -1, revealed: false, revealNext: false, special: null,
      inv: [], modifier: null, subbing: false, used: [], last: null,
      phase: 'spin', vs: opts.vs, vss: opts.vss, log: [],
    };
    render();
  }

  const total = () => S.xi.reduce((t, s) => t + s.g, 0);
  const openPos = () => [...new Set(S.xi.filter(s => s.p == null).map(s => s.pos))];
  const byId = id => GM.players[id];
  const fits = (p, open) => p.poss.some(x => open.includes(x));
  const emptySlots = () => S.xi.filter(s => s.p == null).length;
  const hasFreeSpin = () => S.inv.some(w => WILDCARDS[w].kind === 'special');

  /* ---------------------------------------------------------------- reel generation */
  function makeReels(special) {
    const r = GM.rng(`${S.seed}|${S.spin}|${S.respins}|${special || ''}`);
    const open = openPos();
    const used = new Set(S.used.concat(S.xi.filter(s => s.p != null).map(s => s.p)));
    const pool = GM.players.filter(p => fits(p, open) && !used.has(p.id));
    const wc = special && WILDCARDS[special];
    const n = (wc && wc.reels) || 3;
    const reels = [];
    let wildShown = !!special;
    for (let i = 0; i < n; i++) {
      if (S.rules.wild && S.spin >= 1 && !wildShown && i < 2 && r() < 0.28) {
        const types = Object.keys(WILDCARDS);
        reels.push({ wild: r.weighted(types, t => WILDCARDS[t].w) });
        wildShown = true;
        continue;
      }
      const taken = new Set(reels.filter(x => x.id != null).map(x => x.id));
      let cands = pool.filter(p => !taken.has(p.id));
      let mate = null;
      if (wc && wc.filter) {
        const themed = cands.filter(wc.filter);
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
    if (!special && S.phase === 'spin' && S.spinsLeft != null) S.spinsLeft--;
    S.special = special || null;
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

  function choosePosition(p, options) {
    return new Promise(res => {
      const m = GM.modal(`<h3>Where does ${GM.esc(p.name)} play?</h3>
        <p class="muted">He can fill more than one of your open positions.</p>
        <div class="pos-choice">${options.map(o => `<button class="btn" data-pos="${o}"><span class="pos pos-${GM.GROUP[o]}">${o}</span> ${GM.POS_NAME[o]}</button>`).join('')}</div>
        <div class="row"><button class="btn ghost" data-close>Cancel</button></div>`, { onClose: () => res(null) });
      GM.$$('[data-pos]', m.el).forEach(b => b.onclick = () => { m.el.parentNode.remove(); res(b.dataset.pos); });
    });
  }

  async function sign(i) {
    const reel = S.reels[i];
    if (!reel || S.phase !== 'pick') return;
    if (reel.wild) {
      if (S.inv.length >= 3) { GM.toast('Your wildcard bag is full (3) – use one first'); return; }
      S.inv.push(reel.wild);
      S.log.push('🃏');
      GM.toast(`${WILDCARDS[reel.wild].icon} ${WILDCARDS[reel.wild].name} added to your bag`);
    } else {
      const p = byId(reel.id);
      const open = openPos();
      const options = p.poss.filter(x => open.includes(x));
      if (!options.length) { GM.toast(`No open position for ${GM.esc(p.name)} any more`); return; }
      const pos = options.length > 1 ? await choosePosition(p, options) : options[0];
      if (!pos) return;
      // prefer a wide slot for midfielders who can also play up front, otherwise the first free one
      const slot = S.xi.find(s => s.pos === pos && s.p == null);
      let g = p.goals;
      if (S.modifier === 'captain') g *= 2;
      if (S.modifier === 'rotation') g = Math.floor(g / 2);
      if (S.modifier === 'coin') {
        const heads = GM.rng(`${S.seed}|coin|${S.spin}|${S.respins}`)() < 0.5;
        g = heads ? g * 2 : 0;
        GM.toast(heads ? '🎲 Heads! Goals doubled' : '🎲 Tails… his goals count for nothing', 2600);
      }
      slot.p = p.id; slot.g = g; slot.mod = S.modifier === 'coin' ? (g ? 'captain' : 'zero') : S.modifier;
      slot.as = pos !== p.poss[0] ? pos : null;
      slot.fresh = true;
      S.modifier = null;
      S.last = p.id;
      S.used.push(p.id);
      S.log.push(pos);
    }
    // show what everyone on the reels scored before moving on
    S.revealed = true;
    S.phase = 'reveal';
    S.selected = i;
    render();
    const bust = S.rules.bust && total() > S.target;
    await GM.sleep(S.reels.some(r => !r.wild) ? 1500 : 700);
    S.xi.forEach(s => { s.fresh = false; });
    S.spin++;
    S.reels = [];
    S.selected = -1;
    S.revealed = false;
    S.special = null;
    if (bust || emptySlots() === 0) return finish();
    if (S.spinsLeft === 0 && !hasFreeSpin()) { GM.toast('⏱️ Out of spins – the window has shut!', 2600); return finish(); }
    S.phase = 'spin';
    render();
  }

  function useWild(k) {
    const w = S.inv[k];
    const wc = WILDCARDS[w];
    if (S.phase === 'spinning' || S.phase === 'reveal' || S.phase === 'done') return;
    const consume = () => { S.inv.splice(k, 1); S.log.push(wc.icon); };
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
        S.subbing = k; render(); GM.toast('Tap a player on the pitch to release him'); return;
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
    GM.toast(`👋 ${byId(s.p).name} released (−${s.g})`);
    s.p = null; s.g = 0; s.mod = null; s.as = null;
    S.inv.splice(S.subbing, 1);
    S.log.push('🔄');
    S.subbing = false;
    if (S.spinsLeft === 0) S.spinsLeft = 1; // always allow a spin to fill the gap
    render();
  }

  /* ---------------------------------------------------------------- scoring / finish */
  function scoreFor(st) {
    const t = st.xi.reduce((a, s) => a + s.g, 0);
    const diff = Math.abs(st.target - t);
    const parts = [];
    if (st.rules.bust && t > st.target) return { total: 0, parts: [['💥 Bust – you went over ' + st.target, 0]], diff, t };
    const base = Math.max(0, 1000 - 5 * diff);
    parts.push([`Closeness (${diff} off)`, base]);
    if (diff === 0) parts.push(['🎯 Bullseye!', 500]);
    if (st.rules.wild && st.inv.length) parts.push([`Unused wildcards ×${st.inv.length}`, UNUSED_BONUS * st.inv.length]);
    let sum = parts.reduce((a, p) => a + p[1], 0);
    if (st.rules.bust) { parts.push(['💀 Hardcore ×1.5', Math.round(sum * 0.5)]); sum = Math.round(sum * 1.5); }
    return { total: sum, parts, diff, t };
  }

  async function finish() {
    S.phase = 'done';
    const sc = scoreFor(S);
    S.final = sc;
    if (S.mode === 'daily') GM.store.set('daily:' + GM.today(), { ...S, rules: undefined });
    render();
    if (!S.readonly) {
      if (S.mode === 'daily' && sc.total > GM.best('daily')) GM.store.set('best:daily', sc.total);
      const { isBest } = await GM.recordScore(S.mode === 'daily' ? 'daily:' + GM.today() : S.mode, sc.total, { t: sc.t });
      if (isBest && sc.total > 0 && S.mode !== 'daily') GM.toast('🏆 New personal best!');
    }
  }

  /* ---------------------------------------------------------------- rendering */
  const posBadges = GM.posBadges;

  function reelInner(x) {
    if (!x) return '';
    if (x.wild) {
      const w = WILDCARDS[x.wild];
      return `<div class="wild-card"><div class="wild-icon">${w.icon}</div><div class="wild-name">${w.name}</div><div class="wild-desc">${w.desc}</div><div class="tag">WILDCARD</div></div>`;
    }
    const p = byId(x.id);
    const reveal = S.revealed;
    return `${x.mate ? `<div class="mate" title="Also played for ${GM.esc(x.mate.club)}, like ${GM.esc(x.mate.name)}">🤝 ${GM.clubShort(x.mate.club)} link · ${GM.esc(x.mate.name.split(' ').slice(-1)[0])}</div>` : ''}
      ${GM.avatar(p, 'lg')}
      <div class="reel-name">${GM.esc(p.name)}</div>
      <div class="reel-meta">${posBadges(p)} ${GM.flag(p.nat)} <span>${GM.era(p)}</span></div>
      <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>
      <div class="reel-goals ${reveal ? 'show' : ''}">${reveal ? `<b>${p.goals}</b> goals` : '<b>?</b> goals'}<small>${p.apps} apps</small></div>`;
  }

  const MOD_TAG = { captain: '<i title="Captain – doubled">©</i>', rotation: '<i title="Rotation Risk – halved">🩹</i>', zero: '<i title="Double or Nothing – lost">🎲</i>' };
  function slotHtml(s, i) {
    if (s.p == null) {
      return `<div class="slot empty ${s.pos !== FORMATION[i] ? 'moved' : ''}" data-slot="${i}" title="${GM.POS_NAME[s.pos]}"><span class="pos pos-${GM.GROUP[s.pos]}">${s.pos}</span></div>`;
    }
    const p = byId(s.p);
    const surname = p.name.includes(' ') ? p.name.split(' ').slice(1).join(' ') : p.name;
    return `<div class="slot filled ${s.fresh ? 'fresh' : ''}" data-slot="${i}" title="${GM.esc(p.name)}">
      ${GM.avatar(p)}<span class="slot-name">${GM.esc(surname)}</span>
      <span class="slot-goals">${s.g}${MOD_TAG[s.mod] || ''}</span><span class="slot-pos ${s.as ? 'oop' : ''}" title="${s.as ? 'Playing out of his usual position' : GM.POS_NAME[s.pos]}">${s.pos}</span></div>`;
  }

  function pitchHtml() {
    const lat = i => SIDE[FORMATION[i]] ?? 1;
    const rows = ['F', 'M', 'D', 'G'].map(g => S.xi.map((s, i) => [s, i]).filter(([s]) => GM.GROUP[s.pos] === g)
      .sort((a, b) => lat(a[1]) - lat(b[1]) || a[1] - b[1])).filter(r => r.length);
    const shape = rows.slice(0, -1).reverse().map(r => r.length).join('-');
    return `<div class="pitch ${S.subbing !== false ? 'subbing' : ''}">
      <div class="pitch-lines"></div><div class="shape">${shape}</div>
      ${rows.map(r => `<div class="pitch-row ${r.length > 4 ? 'crowded' : ''}">${r.map(([s, i]) => slotHtml(s, i)).join('')}</div>`).join('')}
    </div>`;
  }

  function counterHtml() {
    const t = total();
    const pct = Math.min(100, t / S.target * 100);
    const over = t > S.target;
    const left = emptySlots();
    const mod = S.modifier ? ` · <b>${WILDCARDS[S.modifier].icon} ${WILDCARDS[S.modifier].name}</b>` : '';
    return `<div class="counter ${over ? 'over' : ''}">
      <div class="counter-num"><b>${t}</b><span>/ ${S.target}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="counter-sub">${over ? `${t - S.target} over` : `${S.target - t} to go`} · ${left} slot${left === 1 ? '' : 's'} left${S.spinsLeft != null ? ` · <span class="${S.spinsLeft <= left ? 'warn' : ''}">${S.spinsLeft} spin${S.spinsLeft === 1 ? '' : 's'} left</span>` : ''}${mod}</div>
    </div>`;
  }

  function render() {
    if (!S) return;
    if (S.phase === 'done') return renderDone();
    const title = GM.MODES[S.mode].name;
    const nReels = Math.max(3, S.reels.length);
    const sp = S.special && WILDCARDS[S.special];
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${GM.MODES[S.mode].icon} ${title}</h2><button class="icon-btn" id="help">?</button></div>
      ${S.vs ? `<div class="banner">⚔️ Beat <b>${GM.esc(S.vs)}</b>’s score of <b>${GM.esc(S.vss)}</b></div>` : ''}
      ${counterHtml()}
      ${pitchHtml()}
      ${S.rules.wild ? `<div class="inv"><span class="inv-label">Wildcards ${S.inv.length}/3</span>${S.inv.length ? S.inv.map((w, k) =>
      `<button class="wild-btn ${S.subbing === k ? 'active' : ''}" data-w="${k}" title="${GM.esc(WILDCARDS[w].desc)}">${WILDCARDS[w].icon}<small>${WILDCARDS[w].name}</small></button>`).join('')
        : '<span class="muted">none yet – they appear on the reels</span>'}${S.subbing !== false ? '<button class="btn small ghost" id="cancel-sub">Cancel</button>' : ''}</div>` : ''}
      ${sp && S.phase !== 'spin' ? `<div class="special-banner">${sp.icon} ${sp.name}</div>` : ''}
      <div class="reels">${Array.from({ length: nReels }, (_, i) => {
          const x = S.reels[i];
          if (S.phase === 'spinning') return `<div class="reel spinning"><div class="reel-spin">…</div></div>`;
          if (!x) return `<div class="reel idle"><div class="reel-q">?</div></div>`;
          return `<button class="reel ${x.wild ? 'is-wild' : ''} ${S.selected === i ? 'selected' : ''} ${S.phase === 'reveal' && S.selected !== i ? 'dim' : ''}" data-reel="${i}">${reelInner(x)}</button>`;
        }).join('')}</div>
      <div class="actions">
        ${S.phase === 'spin' && S.spinsLeft !== 0 ? `<button class="btn big spin" id="spin">🎰 SPIN</button>` : ''}
        ${S.phase === 'spin' && S.spinsLeft === 0 ? `<div class="hint">Out of spins – use a free-spin wildcard, or</div><button class="btn ghost" id="endgame">Blow the final whistle</button>` : ''}
        ${S.phase === 'pick' ? `<div class="hint">Tap a player to sign him${S.reels.some(r => r.wild) ? ' – or grab the wildcard (costs this spin)' : ''}</div>` : ''}
      </div>`;
    GM.$('#help', root).onclick = help;
    const spb = GM.$('#spin', root); if (spb) spb.onclick = () => doSpin();
    const eg = GM.$('#endgame', root); if (eg) eg.onclick = () => finish();
    GM.$$('[data-reel]', root).forEach(b => b.onclick = () => sign(+b.dataset.reel));
    GM.$$('[data-w]', root).forEach(b => b.onclick = () => useWild(+b.dataset.w));
    GM.$$('[data-slot]', root).forEach(b => b.onclick = () => { if (S.subbing !== false) release(+b.dataset.slot); });
    const cs = GM.$('#cancel-sub', root); if (cs) cs.onclick = () => { S.subbing = false; render(); };
  }

  function help() {
    const r = S.rules;
    GM.modal(`<h3>How to play</h3>
      <p>Build an XI whose players have scored <b>${S.target}</b> Premier League goals between them.</p>
      <p>Each spin shows three players who fit an open position. Their goal tallies are hidden – sign the one you think gets you closest.</p>
      <p>Every player has real positions – <b>GK, LB, CB, RB, LM, CM, RM, ST</b> – and can only go in a slot he actually played. Utility men (Dublin up front or at centre-back, Bale at LB/LM/RM/ST, Milner…) show every position they can fill, and you choose where he goes.</p>
      ${r.wild ? `<p><b>Wildcards</b> appear on the reels from the 2nd spin. You get <b>${SPIN_BUDGET} spins</b> for 11 signings, so grabbing a wildcard costs one of your spare spins. Hold up to 3; each unused one is +${UNUSED_BONUS} at full time.</p>
      <ul class="wc-list">${Object.values(WILDCARDS).map(w => `<li>${w.icon} <b>${w.name}</b> – ${w.desc}</li>`).join('')}</ul>` : ''}
      ${r.bust ? '<p>💀 <b>Hardcore:</b> go over and you bust with zero. Survive and your score is multiplied ×1.5.</p>' : ''}
      ${S.mode === 'deep' ? '<p>🔦 <b>Deep Cuts:</b> every 50+ appearance player is equally likely – cult heroes and journeymen galore. Target is 200.</p>' : ''}
      <p><b>Scoring:</b> 1000 − 5 per goal off target. Exactly ${S.target} = +500 bullseye bonus.</p>
      <p>🤝 A player who shares a club with your last signing may turn up to tempt you.</p>
      <div class="row"><button class="btn" data-close>Got it</button></div>`);
  }

  function renderDone() {
    S.rules = RULES[S.mode] || RULES.daily;
    const sc = S.final || scoreFor(S);
    const best = GM.best(S.mode === 'daily' ? 'daily' : S.mode);
    const shareText = resultText(sc);
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${GM.MODES[S.mode].icon} Full time</h2><span></span></div>
      <div class="result">
        <div class="result-total ${sc.diff === 0 ? 'bull' : ''}">${sc.t}<small>goals · target ${S.target}</small></div>
        <div class="result-score">${sc.total}<small>points</small></div>
        <table class="breakdown">${sc.parts.map(([k, v]) => `<tr><td>${k}</td><td>+${v}</td></tr>`).join('')}</table>
        ${S.vs ? `<div class="banner">${sc.total > S.vss ? '🎉 You beat' : sc.total == S.vss ? '🤝 You drew with' : '😬 You lost to'} <b>${GM.esc(S.vs)}</b> (${GM.esc(S.vss)})</div>` : ''}
        <div class="muted">Personal best: ${Math.max(best, sc.total)}</div>
      </div>
      ${pitchHtml()}
      <div class="xi-list">${S.xi.filter(s => s.p != null).map(s => {
        const p = byId(s.p);
        const tag = { captain: ` (${p.goals}×2)`, rotation: ` (${p.goals}÷2)`, zero: ` (${p.goals}×0)` }[s.mod] || '';
        return `<div class="xi-row">${GM.avatar(p)}<span>${GM.esc(p.name)} <small>${s.pos}${s.as ? ' (out of position)' : ''}</small></span><small>${p.apps} apps</small><b>${s.g}${tag}</b></div>`;
      }).join('')}</div>
      <div class="actions col">
        ${S.mode !== 'daily' ? `<button class="btn big" id="again">🔁 Play again</button>` : `<div class="muted">New Daily 442 tomorrow</div>`}
        <button class="btn" id="challenge">⚔️ Challenge a friend (same spins)</button>
        <button class="btn ghost" id="share">📤 Share result</button>
        <a class="btn ghost" href="#/leaderboard?m=${encodeURIComponent(S.mode === 'daily' ? 'daily:' + GM.today() : S.mode)}">🏆 Leaderboard</a>
      </div>`;
    const again = GM.$('#again', root); if (again) again.onclick = () => start(root, S.mode);
    GM.$('#share', root).onclick = () => GM.share(shareText);
    GM.$('#challenge', root).onclick = async () => {
      const name = await GM.askName() || 'A friend';
      const m = S.mode === 'daily' ? 'wild' : S.mode;
      const url = `${GM.baseUrl()}#/draft?m=${m}&seed=${encodeURIComponent(S.seed)}&vs=${encodeURIComponent(name)}&vss=${sc.total}`;
      GM.share(`⚽ Goal Machine – I scored ${sc.total} in ${GM.MODES[m].name} (${sc.t}/${S.target} goals). Same spins, can you beat me?`, url);
    };
  }

  function resultText(sc) {
    const icons = S.log.map(l => ({ G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[GM.GROUP[l]] || l)).join('');
    const head = S.mode === 'daily' ? `Daily 442 · ${GM.today()}` : GM.MODES[S.mode].name;
    return `⚽ Goal Machine – ${head}\n${sc.t}/${S.target} goals${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts\n${icons}`;
  }
})();
