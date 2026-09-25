/* Goal Machine – extra modes: Higher or Lower, Who Am I?, Club Grid, Guess the Tally */
'use strict';

(function () {
  const P = GM.players;
  // opts (all optional) let Head to Head run a game: seed, hard, rounds/time, back (link), done(score) instead of saving
  let backTo = '#/';
  const top = (label, icon) => `<div class="topbar"><a href="${backTo}" class="back">‹</a><h2>${icon} ${label}</h2><span></span></div>`;
  const setup = opts => { backTo = opts.back || '#/'; return { r: GM.rng(opts.seed || GM.newSeed()), hard: opts.hard != null ? opts.hard : GM.isHard() }; };

  async function gameOver(root, mode, score, lines, again, shareText, extra, done) {
    if (done) {  // Head to Head: no saving, just hand the score back
      const box = document.createElement('div');
      box.className = 'result';
      box.innerHTML = `<div class="result-score">${score}<small>points</small></div>${lines || ''}
        <div class="actions col"><button class="btn big" data-next>Continue ➜</button></div>`;
      root.appendChild(box);
      box.scrollIntoView({ behavior: 'smooth' });
      box.querySelector('[data-next]').onclick = () => done(score);
      GM.sound.play('fulltime');
      return;
    }
    if (GM.checkGame) GM.checkGame(mode, score, extra);
    const { isBest } = await GM.recordScore(mode, score);
    GM.sound.play('fulltime');
    if (isBest && score > 0) setTimeout(() => GM.sound.play('cheer'), 1500);
    const box = document.createElement('div');
    box.className = 'result';
    box.innerHTML = `<div class="result-score">${score}<small>points</small></div>
      ${isBest && score > 0 ? '<div class="banner">🏆 New personal best!</div>' : `<div class="muted">Personal best: ${GM.best(mode)}</div>`}
      ${lines || ''}
      <div class="actions col"><button class="btn big" data-again>🔁 Play again</button>
      <button class="btn ghost" data-share>📤 Share</button><a class="btn ghost" href="#/leaderboard?m=${mode}">🏆 Leaderboard</a></div>`;
    root.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth' });
    box.querySelector('[data-again]').onclick = again;
    box.querySelector('[data-share]').onclick = () =>
      GM.share(shareText || `⚽ Goal Machine – ${GM.MODES[mode].name}: ${score} pts. Think you know the Premier League better?`, GM.baseUrl() + '#/' + mode);
  }

  /* =============================================================== HIGHER OR LOWER */
  GM.hilo = function (root, opts = {}) {
    const { r, hard } = setup(opts), key = hard ? 'hiloh' : 'hilo';
    let streak = 0, a, b, stat, busy = false;
    const pickStat = () => (r() < 0.55 ? 'goals' : 'apps');
    const draw = (exclude) => {
      const pool = P.filter(p => p !== exclude && (stat === 'apps' || p.pos !== 'G'));
      return r.weighted(pool, p => p.fame);
    };
    stat = pickStat();
    a = draw(); b = draw(a);
    const label = s => s === 'goals' ? 'PL goals' : 'PL appearances';

    function card(p, show, id) {
      return `<div class="hl-card" id="${id}">${GM.avatar(p, 'lg', hard)}<div class="reel-name">${GM.esc(p.name)}</div>
        <div class="reel-meta">${GM.posBadges(p)}${hard ? '' : ` ${GM.flag(p.nat)} ${GM.era(p)}`}</div>
        ${hard ? '' : `<div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>`}
        <div class="hl-val">${show ? `<b>${p[stat]}</b>` : '<b>?</b>'}<small>${label(stat)}</small></div></div>`;
    }
    function render() {
      root.innerHTML = `${top('Higher or Lower' + (hard ? ' · Hard' : ''), '↕️')}
        <div class="hl-head">Streak <b>${streak}</b>${opts.done ? '' : ` · Best ${GM.best(key)}`}</div>
        <div class="hl">${card(a, true, 'hla')}<div class="vs">VS</div>${card(b, false, 'hlb')}</div>
        <div class="hl-q">Does <b>${GM.esc(b.name)}</b> have more or fewer ${label(stat)} than ${GM.esc(a.name.split(' ').slice(-1)[0])}?</div>
        <div class="actions row2"><button class="btn big up" data-g="1">⬆ Higher</button><button class="btn big down" data-g="-1">⬇ Lower</button></div>
        <div id="hl-over"></div>`;
      GM.$$('[data-g]', root).forEach(btn => btn.onclick = () => guess(+btn.dataset.g));
    }
    async function guess(dir) {
      if (busy) return; busy = true;
      const ok = b[stat] === a[stat] || (dir > 0 ? b[stat] > a[stat] : b[stat] < a[stat]);
      const el = GM.$('#hlb .hl-val b', root);
      await countUp(el, b[stat]);
      GM.$('#hlb', root).classList.add(ok ? 'good' : 'bad');
      GM.sound.play(ok ? 'good' : 'bad');
      await GM.sleep(700);
      if (ok) {
        streak++; GM.buzz();
        a = b; stat = pickStat(); b = draw(a);
        busy = false; render();
      } else {
        GM.$$('[data-g]', root).forEach(x => x.disabled = true);
        gameOver(GM.$('#hl-over', root), key, streak, `<div class="muted">${GM.esc(b.name)}: ${b[stat]} vs ${GM.esc(a.name)}: ${a[stat]}</div>`, () => GM.hilo(root), null, null, opts.done);
      }
    }
    render();
  };

  async function countUp(el, to) {
    const steps = 18;
    for (let i = 1; i <= steps; i++) { el.textContent = Math.round(to * i / steps); await GM.sleep(28); }
  }

  /* =============================================================== WHO AM I */
  GM.whoami = function (root, opts = {}) {
    const { r, hard } = setup(opts);
    const ROUNDS = opts.rounds || 10, PTS = [500, 400, 300, 200, 100];
    const key = hard ? 'whoamih' : 'whoami';
    let round = 0, score = 0, target, clue, results = [], wrong = [];
    const pool = P.filter(p => p.apps >= 100 || p.goals >= 25);
    const next = () => { target = r.weighted(pool, p => Math.pow(p.fame, 1.15)); clue = 0; wrong = []; };
    next();
    const clues = () => {
      const clubs = `<div class="clue"><b>Clubs</b><div class="path">${target.clubs.map(c => GM.clubChip(c, true)).join('<span class="arrow">→</span>')}</div>${hard ? '' : `<small>PL career ${GM.era(target)}</small>`}</div>`;
      const pos = `<div class="clue"><b>Position</b> ${target.poss.map(x => GM.POS_NAME[x]).join(' / ')}</div>`;
      const nat = `<div class="clue"><b>Nationality</b> ${GM.flag(target.nat)} ${GM.esc(target.nat || 'Unknown')}</div>`;
      const rec = `<div class="clue"><b>PL record</b> ${target.apps} apps · ${target.goals} goals</div>`;
      const era = `<div class="clue"><b>PL career</b> ${GM.era(target)}</div>`;
      const ini = `<div class="clue"><b>Initials</b> ${GM.initials(target.name).split('').join('. ')}.</div>`;
      // hard: start vague, clubs only as the last clue and no initials
      return hard ? [pos, nat, era, rec, clubs] : [clubs, pos, nat, rec, ini];
    };
    const isMatch = p => p.id === target.id || (hard && p.name === target.name) ||
      (p.clubs.join() === target.clubs.join() && p.first === target.first && p.last === target.last && p.poss.join() === target.poss.join());

    function render() {
      root.innerHTML = `${top('Who Am I?' + (hard ? ' · Hard' : ''), '🕵️')}
        <div class="hl-head">Round <b>${round + 1}</b>/${ROUNDS} · Score <b>${score}</b> · worth ${PTS[clue] || 0}</div>
        <div class="clues">${clues().slice(0, clue + 1).join('')}</div>
        ${wrong.length ? `<div class="wrong">${wrong.map(p => `<span>✗ ${GM.esc(p.name)}</span>`).join('')}</div>` : ''}
        <div class="guess-box"><input class="input" id="wg" placeholder="Type a player…" autocomplete="off"><div class="ac" id="wac" hidden></div></div>
        <div class="actions row2"><button class="btn ghost" id="wclue">${clue < 4 ? '💡 Another clue' : '🏳️ Give up'}</button></div>
        <div id="wover"></div>`;
      GM.autocomplete(GM.$('#wg', root), GM.$('#wac', root), guess, { exclude: p => wrong.includes(p), plain: hard });
      GM.$('#wclue', root).onclick = () => (clue < 4 ? (clue++, render()) : endRound(false));
      setTimeout(() => GM.$('#wg', root) && GM.$('#wg', root).focus(), 30);
    }
    function guess(p) {
      if (isMatch(p)) return endRound(true);
      wrong.push(p);
      GM.sound.play('bad');
      if (clue < 4) clue++; else if (wrong.length >= 6) return endRound(false);
      GM.toast(`✗ Not ${GM.esc(p.name)}`);
      render();
    }
    function endRound(ok) {
      const pts = ok ? PTS[clue] : 0;
      score += pts;
      GM.sound.play(ok ? 'good' : 'bad');
      results.push(ok ? (clue === 0 ? '🟩' : clue < 3 ? '🟨' : '🟧') : '🟥');
      const m = GM.modal(`<div class="center">${GM.avatar(target, 'lg')}<h3>${ok ? '✅' : '❌'} ${GM.esc(target.name)}</h3>
        <p>${target.apps} apps · ${target.goals} goals · ${GM.era(target)}</p><p><b>+${pts}</b></p>
        <button class="btn" data-close>${round + 1 < ROUNDS ? 'Next player' : 'See score'}</button></div>`, {
        onClose: () => {
          round++;
          if (round >= ROUNDS) {
            root.innerHTML = top('Who Am I?', '🕵️') + `<div class="center big-emoji">${results.join('')}</div>`;
            gameOver(root, key, score, '', () => GM.whoami(root), `⚽ Goal Machine – Who Am I?${hard ? ' (Hard)' : ''}\n${results.join('')}\n${score} pts`, null, opts.done);
          } else { next(); render(); }
        },
      });
    }
    render();
  };

  /* =============================================================== CLUB GRID */
  const clubCount = {};
  P.forEach(p => p.clubs.forEach(c => { clubCount[c] = (clubCount[c] || 0) + 1; }));
  const natCount = {};
  P.forEach(p => { if (p.nat) natCount[p.nat] = (natCount[p.nat] || 0) + 1; });
  const EXTRA = [
    { label: '100+ PL goals', icon: '⚽', test: p => p.goals >= 100 },
    { label: '400+ PL apps', icon: '🏃', test: p => p.apps >= 400 },
    { label: 'Goalkeeper', icon: '🧤', test: p => p.pos === 'G' },
    { label: 'Played in 1992/93', icon: '📼', test: p => p.first === 1992 },
    { label: 'Played 2020s', icon: '📱', test: p => p.last >= 2020 },
    { label: '0 PL goals', icon: '🥅', test: p => p.goals === 0 },
  ];

  function makeGrid(seed) {
    const r = GM.rng(seed);
    const clubs = Object.keys(clubCount).filter(c => clubCount[c] >= 50);
    const nats = Object.keys(natCount).filter(n => natCount[n] >= 25 && n !== 'England');
    for (let tries = 0; tries < 500; tries++) {
      const cs = r.shuffle(clubs);
      const crit = cs.slice(0, 6).map(c => ({ label: c, club: c, test: p => p.clubs.includes(c) }));
      if (r() < 0.75) {
        const n = r.pick(nats);
        const alt = r() < 0.5 ? { label: n, icon: GM.flag(n), test: p => p.nat === n } : r.pick(EXTRA);
        crit[5] = alt;
      }
      const rows = crit.slice(0, 3), cols = crit.slice(3);
      const answers = rows.map(a => cols.map(b => P.filter(p => a.test(p) && b.test(p))));
      if (answers.every(row => row.every(c => c.length >= 3))) return { rows, cols, answers };
    }
    return makeGrid(seed + 'x');
  }

  GM.grid = function (root, daily) {
    backTo = '#/';
    const seed = daily ? 'grid:' + GM.today() : GM.newSeed();
    const hard = GM.isHard();
    const g = makeGrid(seed);
    let guesses = 12;
    const filled = Array(9).fill(null);
    const used = new Set();
    const head = c => c.club ? `<div class="gh">${GM.clubChip(c.club)}<small>${GM.esc(c.label)}</small></div>`
      : `<div class="gh alt"><span>${c.icon}</span><small>${GM.esc(c.label)}</small></div>`;
    const rarity = (cell, p) => {
      const list = g.answers[Math.floor(cell / 3)][cell % 3].slice().sort((a, b) => b.fame - a.fame);
      const rank = list.indexOf(p);
      return 100 + Math.round(100 * rank / Math.max(1, list.length - 1));
    };
    const score = () => filled.reduce((t, f) => t + (f ? f.pts : 0), 0);
    const finished = () => guesses <= 0 || filled.every(Boolean);

    function render() {
      root.innerHTML = `${top((daily ? 'Daily Club Grid' : 'Club Grid') + (hard ? ' · Hard' : ''), '#️⃣')}
        <div class="hl-head">Guesses left <b>${guesses}</b> · Score <b>${score()}</b></div>
        <p class="muted center">Name a player (50+ PL apps) who fits both the row and the column. Obscure picks score more.</p>
        <div class="grid">
          <div></div>${g.cols.map(head).join('')}
          ${g.rows.map((rw, i) => head(rw) + [0, 1, 2].map(j => {
        const k = i * 3 + j, f = filled[k];
        return f ? `<div class="cell done">${GM.avatar(f.p)}<small>${GM.esc(f.p.name)}</small><i>+${f.pts}</i></div>`
          : `<button class="cell" data-cell="${k}" ${finished() ? 'disabled' : ''}>${finished() ? `<small>${g.answers[i][j].length} answers</small>` : '+'}</button>`;
      }).join('')).join('')}
        </div>
        ${daily ? '' : '<div class="actions"><button class="btn ghost" id="newgrid">🔀 New grid</button></div>'}
        <div id="gover"></div>`;
      GM.$$('[data-cell]', root).forEach(b => b.onclick = () => ask(+b.dataset.cell));
      const ng = GM.$('#newgrid', root); if (ng) ng.onclick = () => GM.grid(root, false);
      if (finished()) end();
    }
    function ask(k) {
      const i = Math.floor(k / 3), j = k % 3;
      const m = GM.modal(`<h3>${GM.esc(g.rows[i].label)} × ${GM.esc(g.cols[j].label)}</h3>
        <div class="guess-box"><input class="input" id="gg" placeholder="Type a player…" autocomplete="off"><div class="ac" id="gac" hidden></div></div>
        <div class="row"><button class="btn ghost" data-close>Cancel</button></div>`);
      const inp = GM.$('#gg', m.el);
      GM.autocomplete(inp, GM.$('#gac', m.el), p => {
        m.close();
        if (used.has(p.id)) { GM.toast('Already used that player'); return; }
        guesses--;
        if (g.rows[i].test(p) && g.cols[j].test(p)) {
          used.add(p.id);
          filled[k] = { p, pts: rarity(k, p) };
          GM.toast(`✅ ${GM.esc(p.name)} +${filled[k].pts}`);
          GM.sound.play('good');
        } else { GM.toast(`❌ ${GM.esc(p.name)} doesn't fit`); GM.sound.play('bad'); }
        render();
      }, { plain: hard });
      setTimeout(() => inp.focus(), 50);
    }
    let ended = false;
    function end() {
      if (ended) return; ended = true;
      const grid = [0, 1, 2].map(i => [0, 1, 2].map(j => filled[i * 3 + j] ? '🟩' : '⬛').join('')).join('\n');
      const txt = `⚽ Goal Machine – ${daily ? 'Daily Club Grid ' + GM.today() : 'Club Grid'}\n${grid}\n${score()} pts`;
      if (daily && score() > GM.best('grid')) GM.store.set('best:grid', score());
      gameOver(GM.$('#gover', root), daily ? 'grid:' + GM.today() : hard ? 'gridh' : 'grid', score(), '', () => GM.grid(root, false), txt, { full: filled.every(Boolean) });
    }
    render();
  };

  /* =============================================================== GUESS THE TALLY */
  GM.tally = function (root, opts = {}) {
    const { r, hard } = setup(opts), key = hard ? 'tallyh' : 'tally';
    const ROUNDS = opts.rounds || 10;
    let round = 0, score = 0, p;
    const pool = P.filter(x => x.pos !== 'G');
    const next = () => { p = r.weighted(pool, x => x.fame); };
    next();
    function render() {
      root.innerHTML = `${top('Guess the Tally' + (hard ? ' · Hard' : ''), '🎯')}
        <div class="hl-head">Round <b>${round + 1}</b>/${ROUNDS} · Score <b>${score}</b></div>
        <div class="hl-card solo">${GM.avatar(p, 'lg', hard)}<div class="reel-name">${GM.esc(p.name)}</div>
          <div class="reel-meta">${GM.posBadges(p)}${hard ? '' : ` ${GM.flag(p.nat)} ${GM.era(p)} · ${p.apps} apps`}</div>
          ${hard ? '' : `<div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>`}</div>
        <form class="tally-form"><label>How many Premier League goals?</label>
          <input class="input big-input" type="number" inputmode="numeric" min="0" max="400" required id="tg">
          <button class="btn big">Lock it in</button></form><div id="tover"></div>`;
      const f = GM.$('form', root);
      f.onsubmit = e => {
        e.preventDefault();
        const gv = Math.max(0, parseInt(GM.$('#tg', root).value, 10) || 0);
        const d = Math.abs(gv - p.goals);
        const pts = Math.round(100 * Math.max(0, 1 - d / Math.max(4, 0.35 * p.goals)));
        score += pts;
        GM.sound.play(pts >= 70 ? 'good' : pts >= 30 ? 'place' : 'bad');
        GM.modal(`<div class="center"><h3>${GM.esc(p.name)}</h3><div class="result-total">${p.goals}<small>PL goals (you said ${gv})</small></div>
          <p><b>+${pts}</b> ${d === 0 ? '🎯 Spot on!' : ''}</p><button class="btn" data-close>${round + 1 < ROUNDS ? 'Next' : 'See score'}</button></div>`, {
          onClose: () => {
            round++;
            if (round >= ROUNDS) { root.innerHTML = top('Guess the Tally', '🎯'); gameOver(root, key, score, '', () => GM.tally(root), null, null, opts.done); }
            else { next(); render(); }
          },
        });
      };
      setTimeout(() => GM.$('#tg', root) && GM.$('#tg', root).focus(), 30);
    }
    render();
  };
  /* =============================================================== CLUB HOPPER */
  // Name a player who played for the club on screen, then hop to one of his other PL clubs. 90 seconds.
  GM.hopper = function (root, opts = {}) {
    const TIME = opts.time || 90;
    const { r, hard } = setup(opts), key = hard ? 'hopperh' : 'hopper';
    const big = Object.keys(clubCount).filter(c => clubCount[c] >= 40);
    let club = r.pick(big), hops = 0, left = TIME, used = new Set(), chain = [], timer = null, over = false, choosing = null;
    const fmtT = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    function tick() {
      left--;
      const t = GM.$('#htime', root); if (t) { t.textContent = fmtT(Math.max(0, left)); t.classList.toggle('warn', left <= 10); }
      if (left > 0 && left <= 10) GM.sound.play('clock');
      if (left <= 0) end();
    }
    function penalty(s, msg) {
      left = Math.max(0, left - s);
      GM.toast(`${msg} (−${s}s)`);
      GM.sound.play('bad');
      const t = GM.$('#htime', root); if (t) t.textContent = fmtT(left);
      if (left <= 0) end();
    }

    function render() {
      root.innerHTML = `${top('Club Hopper' + (hard ? ' · Hard' : ''), '🦘')}
        <div class="hop-head"><span>Hops <b>${hops}</b></span><span class="timer" id="htime">${fmtT(left)}</span><span>${opts.done ? '' : 'Best ' + GM.best(key)}</span></div>
        <div class="hop-club">${GM.clubChip(club, true)}</div>
        ${choosing ? `<p class="center">Where next with <b>${GM.esc(choosing.name)}</b>?</p>
          <div class="hop-choices">${choosing.clubs.filter(c => c !== club).map(c => `<button class="btn" data-hop="${GM.esc(c)}">${GM.clubChip(c)} ${GM.esc(c)}</button>`).join('')}</div>`
        : `<p class="center">Name a player who played for <b>${GM.esc(club)}</b> – and another PL club.</p>
          <div class="guess-box"><input class="input" id="hg" placeholder="Type a player…" autocomplete="off"><div class="ac" id="hac" hidden></div></div>
          <div class="actions"><button class="btn ghost small" id="hskip">🔀 New club (−10s)</button></div>`}
        <div class="hop-chain">${chain.slice(-12).map(([p, from, to]) => `<div>${GM.clubChip(from)} → <b>${GM.esc(p.name)}</b> → ${GM.clubChip(to)}</div>`).reverse().join('')}</div>
        <div id="hover"></div>`;
      GM.$$('[data-hop]', root).forEach(b => b.onclick = () => hop(choosing, b.dataset.hop));
      const inp = GM.$('#hg', root);
      if (inp) {
        GM.autocomplete(inp, GM.$('#hac', root), guess, { exclude: p => used.has(p.id), plain: hard });
        setTimeout(() => inp.focus(), 30);
        GM.$('#hskip', root).onclick = () => { penalty(10, '🔀 New club'); club = r.pick(big.filter(c => c !== club)); render(); };
      }
      if (!timer && !over) timer = setInterval(tick, 1000);
    }
    function guess(p) {
      if (over) return;
      if (!p.clubs.includes(club)) return penalty(5, `❌ ${p.name} never played for ${GM.clubShort(club)}`);
      const others = p.clubs.filter(c => c !== club);
      if (!others.length) return penalty(3, `❤️ ${p.name} only ever played for ${GM.clubShort(club)}`);
      used.add(p.id);
      if (others.length === 1) return hop(p, others[0]);
      choosing = p; render();
    }
    function hop(p, to) {
      GM.buzz(); GM.sound.play('good');
      chain.push([p, club, to]);
      hops++; club = to; choosing = null;
      render();
    }
    async function end() {
      if (over) return;
      over = true; clearInterval(timer);
      GM.$$('input, [data-hop], #hskip', root).forEach(x => { x.disabled = true; });
      const route = chain.map(([, from]) => GM.clubShort(from)).concat(chain.length ? [GM.clubShort(club)] : []).join('→');
      gameOver(GM.$('#hover', root), key, hops, `<div class="muted">${chain.length ? route : 'No hops this time'}</div>`, () => GM.hopper(root),
        `⚽ Goal Machine – Club Hopper: ${hops} hops in ${TIME}s 🦘\n${route}`, null, opts.done);
    }
    // stop the clock if the player leaves the page
    window.addEventListener('hashchange', () => { over = true; clearInterval(timer); }, { once: true });
    render();
  };
})();
