/* Goal Machine – the 442 draft game (Classic / Wildcard / Hardcore / Deep Cuts / Daily) */
'use strict';

(function () {
  const FORMATION = ['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'F', 'F'];
  const WILDCARDS = {
    scout: { icon: '🔍', name: "Scout's IQ", desc: 'Reveal the PL goals of the players on the reels.' },
    respin: { icon: '🎰', name: 'Roll Again', desc: 'Throw these three back and spin again.' },
    sub: { icon: '🔄', name: 'Tweak the XI', desc: 'Release one player from your XI (their goals come off).' },
    double: { icon: '✖️2', name: 'Double Up', desc: 'Your next signing’s goals count double.' },
    halve: { icon: '➗2', name: 'Half Time', desc: 'Your next signing’s goals count half (rounded down).' },
  };
  const WILD_WEIGHTS = { scout: 3, respin: 3, sub: 2, double: 1.5, halve: 1.5 };

  const RULES = {
    classic: { target: 442, wild: false, bust: false, weight: p => p.fame },
    wild: { target: 442, wild: true, bust: false, weight: p => p.fame },
    hardcore: { target: 442, wild: false, bust: true, weight: p => p.fame },
    deep: { target: 200, wild: false, bust: false, weight: () => 1 },
    daily: { target: 442, wild: true, bust: false, weight: p => p.fame },
  };

  let S = null; // game state
  let root = null;

  GM.draft = { start, render: () => render(), score: scoreFor, RULES };

  function start(el, mode, opts = {}) {
    root = el;
    const rules = RULES[mode];
    const seed = mode === 'daily' ? 'daily:' + GM.today() : (opts.seed || GM.newSeed());
    if (mode === 'daily') {
      const done = GM.store.get('daily:' + GM.today());
      if (done) { S = done; S.phase = 'done'; S.readonly = true; render(); return; }
    }
    S = {
      mode, seed, rules, target: rules.target, spin: 0, respins: 0,
      xi: FORMATION.map(pos => ({ pos, p: null, g: 0, mod: null })),
      reels: [], selected: -1, revealed: false, revealNext: false,
      inv: [], modifier: null, subbing: false, used: [], last: null,
      phase: 'spin', vs: opts.vs, vss: opts.vss, log: [],
    };
    render();
  }

  const total = () => S.xi.reduce((t, s) => t + s.g, 0);
  const openPos = () => [...new Set(S.xi.filter(s => !s.p).map(s => s.pos))];
  const byId = id => GM.players[id];

  /* ---------------------------------------------------------------- reel generation */
  function makeReels() {
    const r = GM.rng(`${S.seed}|${S.spin}|${S.respins}`);
    const open = openPos();
    const used = new Set(S.used.concat(S.xi.filter(s => s.p != null).map(s => s.p)));
    const pool = GM.players.filter(p => open.includes(p.pos) && !used.has(p.id));
    const reels = [];
    let wildShown = false;
    for (let i = 0; i < 3; i++) {
      if (S.rules.wild && S.spin >= 1 && !wildShown && i < 2 && r() < 0.28) {
        const types = Object.keys(WILD_WEIGHTS);
        reels.push({ wild: r.weighted(types, t => WILD_WEIGHTS[t]) });
        wildShown = true;
        continue;
      }
      const taken = new Set(reels.filter(x => x.id != null).map(x => x.id));
      let cands = pool.filter(p => !taken.has(p.id));
      let mate = null;
      if (i === 1 && S.last != null && r() < 0.35) {
        const lp = byId(S.last);
        const mates = cands.filter(p => p.first <= lp.last && p.last >= lp.first && p.clubs.some(c => lp.clubs.includes(c)));
        if (mates.length) { cands = mates; mate = lp; }
      }
      if (!cands.length) cands = pool.filter(p => !taken.has(p.id));
      const p = r.weighted(cands, S.rules.weight);
      const x = { id: p.id };
      if (mate) x.mate = { name: mate.name, club: p.clubs.find(c => mate.clubs.includes(c)) };
      reels.push(x);
    }
    return reels;
  }

  /* ---------------------------------------------------------------- actions */
  async function doSpin() {
    if (S.phase !== 'spin' && S.phase !== 'pick') return;
    S.reels = makeReels();
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
    const stops = cards.map((c, i) => 500 + i * 280);
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
            c.innerHTML = reelInner(S.reels[i], i);
            c.classList.add('landed');
          }
        });
        if (running) setTimeout(tick, 55); else res();
      };
      tick();
    });
  }

  async function sign(i) {
    const reel = S.reels[i];
    if (!reel || S.phase !== 'pick') return;
    if (reel.wild) {
      if (S.inv.length >= 3) { GM.toast('Your wildcard bag is full (3)'); return; }
      S.inv.push(reel.wild);
      S.log.push('🃏');
      GM.toast(`${WILDCARDS[reel.wild].icon} ${WILDCARDS[reel.wild].name} added to your bag`);
    } else {
      const p = byId(reel.id);
      const slot = S.xi.find(s => s.pos === p.pos && !s.p);
      let g = p.goals;
      if (S.modifier === 'double') g *= 2;
      if (S.modifier === 'halve') g = Math.floor(g / 2);
      slot.p = p.id; slot.g = g; slot.mod = S.modifier; slot.fresh = true;
      S.modifier = null;
      S.last = p.id;
      S.used.push(p.id);
      S.log.push(p.pos);
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
    if (bust || S.xi.every(s => s.p != null)) return finish(bust);
    S.phase = 'spin';
    render();
  }

  function useWild(k) {
    const w = S.inv[k];
    if (S.phase === 'spinning' || S.phase === 'reveal' || S.phase === 'done') return;
    if (w === 'scout') {
      if (S.phase === 'pick') S.revealed = true; else S.revealNext = true;
      GM.toast(S.phase === 'pick' ? '🔍 Scout report in' : '🔍 Your next spin will be scouted');
    } else if (w === 'respin') {
      if (S.phase !== 'pick') { GM.toast('Spin first, then use Roll Again on reels you don’t like'); return; }
      S.respins++;
      S.inv.splice(k, 1);
      doSpin();
      return;
    } else if (w === 'sub') {
      if (!S.xi.some(s => s.p != null)) { GM.toast('No one to release yet'); return; }
      S.subbing = k;
      render();
      GM.toast('Tap a player on the pitch to release him');
      return;
    } else if (w === 'double' || w === 'halve') {
      if (S.modifier) { GM.toast('A modifier is already active'); return; }
      S.modifier = w;
      GM.toast(`${WILDCARDS[w].icon} active on your next signing`);
    }
    S.inv.splice(k, 1);
    render();
  }

  function release(slotIdx) {
    const s = S.xi[slotIdx];
    if (S.subbing === false || s.p == null) return;
    GM.toast(`👋 ${byId(s.p).name} released (−${s.g})`);
    s.p = null; s.g = 0; s.mod = null;
    S.inv.splice(S.subbing, 1);
    S.subbing = false;
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
    if (st.rules.wild && st.inv.length) parts.push([`Unused wildcards ×${st.inv.length}`, 100 * st.inv.length]);
    let sum = parts.reduce((a, p) => a + p[1], 0);
    if (st.rules.bust) { parts.push(['💀 Hardcore ×1.5', Math.round(sum * 0.5)]); sum = Math.round(sum * 1.5); }
    return { total: sum, parts, diff, t };
  }

  async function finish(bust) {
    S.phase = 'done';
    const sc = scoreFor(S);
    S.final = sc;
    if (S.mode === 'daily') {
      GM.store.set('daily:' + GM.today(), { ...S, rules: undefined, rulesKey: 'daily' });
    }
    render();
    if (!S.readonly) {
      if (S.mode === 'daily' && sc.total > GM.best('daily')) GM.store.set('best:daily', sc.total);
      const { isBest } = await GM.recordScore(S.mode === 'daily' ? 'daily:' + GM.today() : S.mode, sc.total, { t: sc.t });
      if (isBest && sc.total > 0 && S.mode !== 'daily') GM.toast('🏆 New personal best!');
    }
  }

  /* ---------------------------------------------------------------- rendering */
  function reelInner(x, i) {
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
      <div class="reel-meta"><span class="pos pos-${p.pos}">${GM.POS_SHORT[p.pos]}</span> ${GM.flag(p.nat)} <span>${GM.era(p)}</span></div>
      <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>
      <div class="reel-goals ${reveal ? 'show' : ''}">${reveal ? `<b>${p.goals}</b> goals` : '<b>?</b> goals'}<small>${p.apps} apps</small></div>`;
  }

  function slotHtml(s, i) {
    if (s.p == null) {
      const hint = S.subbing !== false ? '' : '';
      return `<div class="slot empty" data-slot="${i}">${hint}<span class="pos pos-${s.pos}">${GM.POS_SHORT[s.pos]}</span></div>`;
    }
    const p = byId(s.p);
    const surname = p.name.includes(' ') ? p.name.split(' ').slice(1).join(' ') : p.name;
    return `<div class="slot filled ${s.fresh ? 'fresh' : ''} ${S.subbing !== false ? 'subbable' : ''}" data-slot="${i}" title="${GM.esc(p.name)}">
      ${GM.avatar(p)}<span class="slot-name">${GM.esc(surname)}</span>
      <span class="slot-goals">${s.g}${s.mod === 'double' ? '<i>×2</i>' : s.mod === 'halve' ? '<i>½</i>' : ''}</span></div>`;
  }

  function pitchHtml() {
    const rows = [['F', [9, 10]], ['M', [5, 6, 7, 8]], ['D', [1, 2, 3, 4]], ['G', [0]]];
    return `<div class="pitch ${S.subbing !== false ? 'subbing' : ''}">
      <div class="pitch-lines"></div>
      ${rows.map(([, idx]) => `<div class="pitch-row">${idx.map(i => slotHtml(S.xi[i], i)).join('')}</div>`).join('')}
    </div>`;
  }

  function counterHtml() {
    const t = total();
    const pct = Math.min(100, t / S.target * 100);
    const over = t > S.target;
    const left = S.xi.filter(s => s.p == null).length;
    return `<div class="counter ${over ? 'over' : ''}">
      <div class="counter-num"><b>${t}</b><span>/ ${S.target}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="counter-sub">${over ? `${t - S.target} over` : `${S.target - t} to go`} · ${left} slot${left === 1 ? '' : 's'} left${S.modifier ? ` · <b>${WILDCARDS[S.modifier].icon} active</b>` : ''}</div>
    </div>`;
  }

  function render() {
    if (!S) return;
    if (S.phase === 'done') return renderDone();
    const title = GM.MODES[S.mode].name;
    root.innerHTML = `
      <div class="topbar"><a href="#/" class="back">‹</a><h2>${GM.MODES[S.mode].icon} ${title}</h2><button class="icon-btn" id="help">?</button></div>
      ${S.vs ? `<div class="banner">⚔️ Beat <b>${GM.esc(S.vs)}</b>’s score of <b>${GM.esc(S.vss)}</b></div>` : ''}
      ${counterHtml()}
      ${pitchHtml()}
      ${S.rules.wild ? `<div class="inv"><span class="inv-label">Wildcards</span>${S.inv.length ? S.inv.map((w, k) =>
      `<button class="wild-btn ${S.subbing === k ? 'active' : ''}" data-w="${k}" title="${WILDCARDS[w].desc}">${WILDCARDS[w].icon}<small>${WILDCARDS[w].name}</small></button>`).join('')
        : '<span class="muted">none yet – they appear on the reels</span>'}${S.subbing !== false ? '<button class="btn small ghost" id="cancel-sub">Cancel</button>' : ''}</div>` : ''}
      <div class="reels">${[0, 1, 2].map(i => {
          const x = S.reels[i];
          if (S.phase === 'spinning') return `<div class="reel spinning"><div class="reel-spin">…</div></div>`;
          if (!x) return `<div class="reel idle"><div class="reel-q">?</div></div>`;
          return `<button class="reel ${x.wild ? 'is-wild' : ''} ${S.selected === i ? 'selected' : ''} ${S.phase === 'reveal' && S.selected !== i ? 'dim' : ''}" data-reel="${i}">${reelInner(x, i)}</button>`;
        }).join('')}</div>
      <div class="actions">
        ${S.phase === 'spin' ? `<button class="btn big spin" id="spin">🎰 SPIN</button>` : ''}
        ${S.phase === 'pick' ? `<div class="hint">Tap a player to sign him${S.reels.some(r => r.wild) ? ' – or grab the wildcard' : ''}</div>` : ''}
      </div>`;
    GM.$('#help', root).onclick = help;
    const sp = GM.$('#spin', root); if (sp) sp.onclick = doSpin;
    GM.$$('[data-reel]', root).forEach(b => b.onclick = () => sign(+b.dataset.reel));
    GM.$$('[data-w]', root).forEach(b => b.onclick = () => useWild(+b.dataset.w));
    GM.$$('[data-slot]', root).forEach(b => b.onclick = () => { if (S.subbing !== false) release(+b.dataset.slot); });
    const cs = GM.$('#cancel-sub', root); if (cs) cs.onclick = () => { S.subbing = false; render(); };
  }

  function help() {
    const r = S.rules;
    GM.modal(`<h3>How to play</h3>
      <p>Build a 4-4-2 whose players have scored <b>${S.target}</b> Premier League goals between them.</p>
      <p>Each spin shows three players who fit an open position. Their goal tallies are hidden – sign the one you think gets you closest.</p>
      ${r.wild ? `<p><b>Wildcards</b> appear on the reels from the 2nd spin. Grabbing one costs you that spin's signing, but you keep it for later:</p>
      <ul>${Object.values(WILDCARDS).map(w => `<li>${w.icon} <b>${w.name}</b> – ${w.desc}</li>`).join('')}</ul>` : ''}
      ${r.bust ? '<p>💀 <b>Hardcore:</b> go over and you bust with zero. Survive and your score is multiplied ×1.5.</p>' : ''}
      ${S.mode === 'deep' ? '<p>🔦 <b>Deep Cuts:</b> every 50+ appearance player is equally likely – cult heroes and journeymen galore. Target is 200.</p>' : ''}
      <p><b>Scoring:</b> 1000 − 5 per goal off target. Exactly ${S.target} = +500 bullseye bonus.${r.wild ? ' Each unused wildcard at full-time = +100.' : ''}</p>
      <p>🤝 A player who shares a club with your last signing may turn up to tempt you.</p>
      <div class="row"><button class="btn" data-close>Got it</button></div>`);
  }

  function renderDone() {
    const sc = S.final || scoreFor(S);
    const rules = RULES[S.mode] || RULES.daily;
    S.rules = rules;
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
      <div class="xi-list">${S.xi.filter(s => s.p != null).map(s => { const p = byId(s.p); return `<div class="xi-row">${GM.avatar(p)}<span>${GM.esc(p.name)}</span><small>${p.apps} apps</small><b>${s.g}${s.mod ? (s.mod === 'double' ? ' (×2)' : ' (½)') : ''}</b></div>`; }).join('')}</div>
      <div class="actions col">
        ${S.mode !== 'daily' ? `<button class="btn big" id="again">🔁 Play again</button>` : `<div class="muted">New Daily 442 tomorrow</div>`}
        <button class="btn" id="challenge">⚔️ Challenge a friend (same spins)</button>
        <button class="btn ghost" id="share">📤 Share result</button>
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
    const icons = S.log.map(l => ({ G: '🧤', D: '🛡️', M: '⚙️', F: '⚽', '🃏': '🃏' }[l] || '')).join('');
    const head = S.mode === 'daily' ? `Daily 442 · ${GM.today()}` : GM.MODES[S.mode].name;
    return `⚽ Goal Machine – ${head}\n${sc.t}/${S.target} goals${sc.diff === 0 ? ' 🎯 BULLSEYE' : ''} · ${sc.total} pts\n${icons}`;
  }
})();
