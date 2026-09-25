/* Goal Machine – Head to Head: two players, one phone, a best-of series of random quick games */
'use strict';

(function () {
  const GAMES = {
    hilo: { name: 'Higher or Lower', icon: '↕️', rule: 'More goals or apps? Longest streak wins.', run: (root, o) => GM.hilo(root, o) },
    whoami: { name: 'Who Am I?', icon: '🕵️', rule: 'Three mystery players. The fewer clues you need, the more you score.', run: (root, o) => GM.whoami(root, { ...o, rounds: 3 }) },
    tally: { name: 'Guess the Tally', icon: '🔢', rule: 'Five players. Guess their PL goals, and closest scores most.', run: (root, o) => GM.tally(root, { ...o, rounds: 5 }) },
    hopper: { name: 'Club Hopper', icon: '🦘', rule: '60 seconds. Hop club to club through players. Most hops wins.', run: (root, o) => GM.hopper(root, { ...o, time: 60 }) },
  };
  const COLOURS = ['p1', 'p2'];
  const get = () => GM.store.get('h2h', null);
  const save = m => GM.store.set('h2h', m);
  const need = m => Math.floor(m.bestOf / 2) + 1;
  const wins = (m, i) => m.rounds.filter(r => r.winner === i).length;
  const champion = m => [0, 1].find(i => wins(m, i) >= need(m));
  const esc = GM.esc;
  const name = (m, i) => `<span class="pname ${COLOURS[i]}">${esc(m.names[i])}</span>`;

  // the next game in a shuffled cycle, never the same game twice in a row
  function addRound(m) {
    const r = GM.rng(m.seed + ':order:' + m.rounds.length);
    const last = m.rounds.length ? m.rounds[m.rounds.length - 1].game : null;
    const options = Object.keys(GAMES).filter(g => g !== last && !m.rounds.slice(-2).some(x => x.game === g));
    m.rounds.push({ game: r.pick(options.length ? options : Object.keys(GAMES).filter(g => g !== last)), scores: [null, null], winner: null });
  }
  const current = m => m.rounds[m.rounds.length - 1];

  function scoreboard(m) {
    const total = Math.max(m.bestOf, m.rounds.length);
    const dots = Array.from({ length: total }, (_, i) => {
      const r = m.rounds[i];
      const cls = !r ? '' : r.winner === 0 ? 'p1' : r.winner === 1 ? 'p2' : r.winner === -1 ? 'draw' : 'live';
      return `<i class="dot ${cls}" title="Round ${i + 1}${r ? ': ' + GAMES[r.game].name : ''}"></i>`;
    }).join('');
    return `<div class="h2h-board">
      <div class="h2h-team p1"><span class="h2h-shirt">👕</span><b>${esc(m.names[0])}</b><strong>${wins(m, 0)}</strong></div>
      <div class="h2h-mid"><small>Best of ${m.bestOf}</small><span>VS</span><small>First to ${need(m)}</small></div>
      <div class="h2h-team p2"><span class="h2h-shirt">👕</span><b>${esc(m.names[1])}</b><strong>${wins(m, 1)}</strong></div>
    </div>
    <div class="h2h-dots">${dots}<span class="h2h-cup">🏆</span></div>`;
  }

  /* ---------------------------------------------------------------- #/h2h */
  GM.h2h = function (root) {
    const m = get();
    if (!m) return setupScreen(root);
    if (champion(m) != null) return trophyScreen(root, m);
    const cur = current(m), g = GAMES[cur.game], turn = cur.scores[0] == null ? 0 : 1;
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>⚔️ Head to Head</h2><span></span></div>
      ${scoreboard(m)}
      <div class="h2h-next">
        <div class="h2h-round">Round ${m.rounds.length}${m.rounds.length > m.bestOf ? ' · Extra time' : ''}</div>
        <div class="h2h-game"><span>${g.icon}</span><b>${g.name}</b></div>
        <p>${g.rule}</p>
        ${cur.scores[0] != null ? `<p class="muted">${esc(m.names[0])} scored <b>${cur.scores[0]}</b>. Can ${esc(m.names[1])} beat it?</p>` : ''}
        <a class="btn big h2h-go ${COLOURS[turn]}" href="#/h2hplay">▶ ${esc(m.names[turn])} to play</a>
      </div>
      <div class="h2h-log">${m.rounds.filter(r => r.winner != null).map((r, i) => `<div><span>${GAMES[r.game].icon} ${GAMES[r.game].name}</span>
        <span><b class="${r.winner === 0 ? 'p1' : ''}">${r.scores[0]}</b> – <b class="${r.winner === 1 ? 'p2' : ''}">${r.scores[1]}</b></span></div>`).join('')}</div>
      <div class="actions"><button class="btn ghost small" id="h2hquit">🏳️ Abandon match</button></div>`;
    GM.$('#h2hquit').onclick = () => {
      const q = GM.modal(`<h3>Abandon this match?</h3><p class="muted">The score so far will be lost.</p>
        <div class="row"><button class="btn ghost" data-close>Keep playing</button><button class="btn down" id="h2hq">Abandon</button></div>`);
      GM.$('#h2hq', q.el).onclick = () => { q.close(); GM.store.set('h2h', null); GM.h2h(root); };
    };
  };

  function setupScreen(root) {
    const last = GM.store.get('h2hNames', [GM.getName() || '', '']);
    let bestOf = GM.store.get('h2hBestOf', 5), hard = GM.isHard();
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>⚔️ Head to Head</h2><span></span></div>
      <div class="variant-row"><span class="on">📱 Same phone</span><a href="#/online">🌐 Online</a></div>
      <div class="h2h-hero"><div class="h2h-trophy">🏆</div>
        <h3>Who knows their football?</h3>
        <p>Two players, one phone. Take turns at a best-of series of random quick games. Win a round to take a point, and the first to the target lifts the trophy.</p></div>
      <form id="h2hform" class="h2h-setup">
        <label class="h2h-name p1"><span>👕</span><input class="input" maxlength="14" name="a" placeholder="Player 1" value="${esc(last[0])}"></label>
        <div class="h2h-vs">VS</div>
        <label class="h2h-name p2"><span>👕</span><input class="input" maxlength="14" name="b" placeholder="Player 2" value="${esc(last[1])}"></label>
        <div class="seg" id="h2hbest">${[3, 5, 7].map(n => `<button type="button" data-n="${n}" class="${n === bestOf ? 'on' : ''}">Best of ${n}</button>`).join('')}</div>
        <div class="seg" id="h2hhard"><button type="button" data-h="0" class="${hard ? '' : 'on'}">🙂 Normal</button><button type="button" data-h="1" class="${hard ? 'on' : ''}">🥵 Hard</button></div>
        <button class="btn big">⚽ Kick off</button>
      </form>
      <p class="muted center">Games: ${Object.values(GAMES).map(g => g.icon + ' ' + g.name).join(' · ')}</p>`;
    GM.$$('#h2hbest [data-n]').forEach(b => b.onclick = () => { bestOf = +b.dataset.n; GM.$$('#h2hbest button').forEach(x => x.classList.toggle('on', x === b)); });
    GM.$$('#h2hhard [data-h]').forEach(b => b.onclick = () => { hard = b.dataset.h === '1'; GM.$$('#h2hhard button').forEach(x => x.classList.toggle('on', x === b)); });
    GM.$('#h2hform').onsubmit = e => {
      e.preventDefault();
      const f = e.target;
      const names = [f.a.value.trim() || 'Player 1', f.b.value.trim() || 'Player 2'];
      if (names[0] === names[1]) names[1] += ' 2';
      GM.store.set('h2hNames', names); GM.store.set('h2hBestOf', bestOf);
      const m = { names, bestOf, hard, seed: GM.newSeed(), rounds: [] };
      addRound(m); save(m);
      location.hash = '#/h2hplay';
    };
  }

  /* ---------------------------------------------------------------- #/h2hplay */
  GM.h2hPlay = function (root) {
    const m = get();
    if (!m || champion(m) != null) { location.hash = '#/h2h'; return; }
    const cur = current(m), g = GAMES[cur.game], turn = cur.scores[0] == null ? 0 : 1;
    // hand-over screen first, so the other player can look away
    root.innerHTML = `<div class="pass ${COLOURS[turn]}">
        <small>Round ${m.rounds.length} · ${g.icon} ${g.name}</small>
        <div class="pass-shirt">👕</div>
        <h2>${turn === 0 ? '' : 'Pass the phone to '}${esc(m.names[turn])}</h2>
        <p>${turn === 0 ? 'You\'re up first.' : `Score to beat: <b>${cur.scores[0]}</b>`}</p>
        <p class="pass-rule">${g.rule}</p>
        <button class="btn big" id="ready">I'm ready</button>
        <a class="pass-back" href="#/h2h">Back to the scoreboard</a>
      </div>`;
    GM.sound.play('sting');
    GM.$('#ready').onclick = () => {
      GM.buzz(30);
      g.run(root, {
        seed: `${m.seed}:${m.rounds.length}:${turn}`, hard: m.hard, back: '#/h2h',
        done: score => finishTurn(root, turn, score),
      });
    };
  };

  function finishTurn(root, turn, score) {
    const m = get(), cur = current(m);
    cur.scores[turn] = score;
    if (turn === 0) { save(m); GM.h2hPlay(root); return; }
    const [a, b] = cur.scores;
    cur.winner = a > b ? 0 : b > a ? 1 : -1;
    const done = champion(m) != null;
    if (!done) addRound(m);
    save(m);
    GM.buzz(cur.winner === -1 ? 20 : [40, 60, 40]);
    setTimeout(() => GM.sound.play(cur.winner === -1 ? 'whistle' : 'cheer'), 300);
    const headline = cur.winner === -1 ? '🤝 Honours even' : `${name(m, cur.winner)} takes the round`;
    GM.modal(`<div class="center round-result"><small>Round ${m.rounds.length - (done ? 0 : 1)} · ${GAMES[cur.game].name}</small>
      <h3>${headline}</h3>
      <div class="rr-score"><b class="p1">${a}</b><span>–</span><b class="p2">${b}</b></div>
      <div class="rr-names"><span>${esc(m.names[0])}</span><span>${esc(m.names[1])}</span></div>
      <p class="muted">Match: ${esc(m.names[0])} ${wins(m, 0)} – ${wins(m, 1)} ${esc(m.names[1])}</p>
      <button class="btn big" data-close>${done ? '🏆 Full time' : 'Next round'}</button></div>`,
      { onClose: () => { location.hash = '#/h2h'; } });
  }

  function trophyScreen(root, m) {
    const w = champion(m), score = `${wins(m, w)}–${wins(m, 1 - w)}`;
    root.innerHTML = `<div class="topbar"><a href="#/" class="back">‹</a><h2>⚔️ Full time</h2><span></span></div>
      <div class="champ ${COLOURS[w]}">
        <div class="confetti">${'<i></i>'.repeat(18)}</div>
        <div class="champ-cup">🏆</div>
        <small>Champion</small>
        <h2>${esc(m.names[w])}</h2>
        <div class="champ-score">${score}</div>
      </div>
      ${scoreboard(m)}
      <div class="h2h-log">${m.rounds.map(r => `<div><span>${GAMES[r.game].icon} ${GAMES[r.game].name}</span>
        <span><b class="${r.winner === 0 ? 'p1' : ''}">${r.scores[0]}</b> – <b class="${r.winner === 1 ? 'p2' : ''}">${r.scores[1]}</b></span></div>`).join('')}</div>
      <div class="actions col">
        <button class="btn big" id="rematch">🔁 Rematch</button>
        <button class="btn ghost" id="h2hshare">📤 Share the result</button>
        <button class="btn ghost" id="newplayers">👥 New players</button>
      </div>`;
    GM.sound.play('fanfare');
    GM.$('#rematch').onclick = () => {
      const n = { names: m.names, bestOf: m.bestOf, hard: m.hard, seed: GM.newSeed(), rounds: [] };
      addRound(n); save(n); location.hash = '#/h2hplay';
    };
    GM.$('#newplayers').onclick = () => { GM.store.set('h2h', null); GM.h2h(root); };
    GM.$('#h2hshare').onclick = () => GM.share(`⚔️ Goal Machine Head to Head\n🏆 ${m.names[w]} beat ${m.names[1 - w]} ${score}\n` +
      m.rounds.map(r => `${GAMES[r.game].icon} ${r.scores[0]}–${r.scores[1]}`).join('  '), GM.baseUrl());
  }
})();
