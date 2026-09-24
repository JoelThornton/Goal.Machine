/* Goal Machine – extra modes: Higher or Lower, Who Am I?, Club Grid, Guess the Tally */
'use strict';

(function () {
  const P = GM.players;
  const top = (label, icon) => `<div class="topbar"><a href="#/" class="back">‹</a><h2>${icon} ${label}</h2><span></span></div>`;

  async function gameOver(root, mode, score, lines, again, shareText) {
    const { isBest } = await GM.recordScore(mode, score);
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
  GM.hilo = function (root) {
    const r = GM.rng(GM.newSeed());
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
      return `<div class="hl-card" id="${id}">${GM.avatar(p, 'lg')}<div class="reel-name">${GM.esc(p.name)}</div>
        <div class="reel-meta"><span class="pos pos-${p.pos}">${GM.POS_SHORT[p.pos]}</span> ${GM.flag(p.nat)} ${GM.era(p)}</div>
        <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div>
        <div class="hl-val">${show ? `<b>${p[stat]}</b>` : '<b>?</b>'}<small>${label(stat)}</small></div></div>`;
    }
    function render() {
      root.innerHTML = `${top('Higher or Lower', '↕️')}
        <div class="hl-head">Streak <b>${streak}</b> · Best ${GM.best('hilo')}</div>
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
      await GM.sleep(700);
      if (ok) {
        streak++;
        a = b; stat = pickStat(); b = draw(a);
        busy = false; render();
      } else {
        GM.$$('[data-g]', root).forEach(x => x.disabled = true);
        gameOver(GM.$('#hl-over', root), 'hilo', streak, `<div class="muted">${GM.esc(b.name)}: ${b[stat]} vs ${GM.esc(a.name)}: ${a[stat]}</div>`, () => GM.hilo(root));
      }
    }
    render();
  };

  async function countUp(el, to) {
    const steps = 18;
    for (let i = 1; i <= steps; i++) { el.textContent = Math.round(to * i / steps); await GM.sleep(28); }
  }

  /* =============================================================== WHO AM I */
  GM.whoami = function (root) {
    const r = GM.rng(GM.newSeed());
    const ROUNDS = 10, PTS = [500, 400, 300, 200, 100];
    let round = 0, score = 0, target, clue, results = [], wrong = [];
    const pool = P.filter(p => p.apps >= 100 || p.goals >= 25);
    const next = () => { target = r.weighted(pool, p => Math.pow(p.fame, 1.15)); clue = 0; wrong = []; };
    next();
    const clues = () => [
      `<div class="clue"><b>Clubs</b><div class="path">${target.clubs.map(c => GM.clubChip(c, true)).join('<span class="arrow">→</span>')}</div><small>PL career ${GM.era(target)}</small></div>`,
      `<div class="clue"><b>Position</b> ${target.poss.map(x => GM.POS_NAME[x]).join(' / ')}</div>`,
      `<div class="clue"><b>Nationality</b> ${GM.flag(target.nat)} ${GM.esc(target.nat || 'Unknown')}</div>`,
      `<div class="clue"><b>PL record</b> ${target.apps} apps · ${target.goals} goals</div>`,
      `<div class="clue"><b>Initials</b> ${GM.initials(target.name).split('').join('. ')}.</div>`,
    ];
    const isMatch = p => p.id === target.id ||
      (p.clubs.join() === target.clubs.join() && p.first === target.first && p.last === target.last && p.pos === target.pos);

    function render() {
      root.innerHTML = `${top('Who Am I?', '🕵️')}
        <div class="hl-head">Round <b>${round + 1}</b>/${ROUNDS} · Score <b>${score}</b> · worth ${PTS[clue] || 0}</div>
        <div class="clues">${clues().slice(0, clue + 1).join('')}</div>
        ${wrong.length ? `<div class="wrong">${wrong.map(p => `<span>✗ ${GM.esc(p.name)}</span>`).join('')}</div>` : ''}
        <div class="guess-box"><input class="input" id="wg" placeholder="Type a player…" autocomplete="off"><div class="ac" id="wac" hidden></div></div>
        <div class="actions row2"><button class="btn ghost" id="wclue">${clue < 4 ? '💡 Another clue' : '🏳️ Give up'}</button></div>
        <div id="wover"></div>`;
      GM.autocomplete(GM.$('#wg', root), GM.$('#wac', root), guess, { exclude: p => wrong.includes(p) });
      GM.$('#wclue', root).onclick = () => (clue < 4 ? (clue++, render()) : endRound(false));
      setTimeout(() => GM.$('#wg', root) && GM.$('#wg', root).focus(), 30);
    }
    function guess(p) {
      if (isMatch(p)) return endRound(true);
      wrong.push(p);
      if (clue < 4) clue++; else if (wrong.length >= 6) return endRound(false);
      GM.toast(`✗ Not ${GM.esc(p.name)}`);
      render();
    }
    function endRound(ok) {
      const pts = ok ? PTS[clue] : 0;
      score += pts;
      results.push(ok ? (clue === 0 ? '🟩' : clue < 3 ? '🟨' : '🟧') : '🟥');
      const m = GM.modal(`<div class="center">${GM.avatar(target, 'lg')}<h3>${ok ? '✅' : '❌'} ${GM.esc(target.name)}</h3>
        <p>${target.apps} apps · ${target.goals} goals · ${GM.era(target)}</p><p><b>+${pts}</b></p>
        <button class="btn" data-close>${round + 1 < ROUNDS ? 'Next player' : 'See score'}</button></div>`, {
        onClose: () => {
          round++;
          if (round >= ROUNDS) {
            root.innerHTML = top('Who Am I?', '🕵️') + `<div class="center big-emoji">${results.join('')}</div>`;
            gameOver(root, 'whoami', score, '', () => GM.whoami(root), `⚽ Goal Machine – Who Am I?\n${results.join('')}\n${score} pts`);
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
    const seed = daily ? 'grid:' + GM.today() : GM.newSeed();
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
      root.innerHTML = `${top(daily ? 'Daily Club Grid' : 'Club Grid', '#️⃣')}
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
        } else GM.toast(`❌ ${GM.esc(p.name)} doesn't fit`);
        render();
      });
      setTimeout(() => inp.focus(), 50);
    }
    let ended = false;
    function end() {
      if (ended) return; ended = true;
      const grid = [0, 1, 2].map(i => [0, 1, 2].map(j => filled[i * 3 + j] ? '🟩' : '⬛').join('')).join('\n');
      const txt = `⚽ Goal Machine – ${daily ? 'Daily Club Grid ' + GM.today() : 'Club Grid'}\n${grid}\n${score()} pts`;
      if (daily && score() > GM.best('grid')) GM.store.set('best:grid', score());
      gameOver(GM.$('#gover', root), daily ? 'grid:' + GM.today() : 'grid', score(), '', () => GM.grid(root, false), txt);
    }
    render();
  };

  /* =============================================================== GUESS THE TALLY */
  GM.tally = function (root) {
    const r = GM.rng(GM.newSeed());
    const ROUNDS = 10;
    let round = 0, score = 0, p;
    const pool = P.filter(x => x.pos !== 'G');
    const next = () => { p = r.weighted(pool, x => x.fame); };
    next();
    function render() {
      root.innerHTML = `${top('Guess the Tally', '🎯')}
        <div class="hl-head">Round <b>${round + 1}</b>/${ROUNDS} · Score <b>${score}</b></div>
        <div class="hl-card solo">${GM.avatar(p, 'lg')}<div class="reel-name">${GM.esc(p.name)}</div>
          <div class="reel-meta"><span class="pos pos-${p.pos}">${GM.POS_SHORT[p.pos]}</span> ${GM.flag(p.nat)} ${GM.era(p)} · ${p.apps} apps</div>
          <div class="chips">${p.clubs.map(c => GM.clubChip(c)).join('')}</div></div>
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
        GM.modal(`<div class="center"><h3>${GM.esc(p.name)}</h3><div class="result-total">${p.goals}<small>PL goals (you said ${gv})</small></div>
          <p><b>+${pts}</b> ${d === 0 ? '🎯 Spot on!' : ''}</p><button class="btn" data-close>${round + 1 < ROUNDS ? 'Next' : 'See score'}</button></div>`, {
          onClose: () => {
            round++;
            if (round >= ROUNDS) { root.innerHTML = top('Guess the Tally', '🎯'); gameOver(root, 'tally', score, '', () => GM.tally(root)); }
            else { next(); render(); }
          },
        });
      };
      setTimeout(() => GM.$('#tg', root) && GM.$('#tg', root).focus(), 30);
    }
    render();
  };
})();
