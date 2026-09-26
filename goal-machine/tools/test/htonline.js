// 🃏 Hat-Trick online: Alice challenges Bob; both phones bid and play through the screen, see the same game, then the
// rest of the match is played out move by move (each phone only moving on its own turn) to full time.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const phone = async (name, key) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await server.attach(ctx);
    await ctx.route(/wikimedia|premierleague|transfermarkt/, r => r.abort());
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e.message));
    server.fns.claim_name({ p_username: name, p_key: key });
    await pg.goto(U); await pg.evaluate(([n, k]) => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); localStorage.setItem('gm:account', JSON.stringify({ name: n, key: k })); }, [name, key]);
    return pg;
  };
  const A = await phone('Alice', 'a'.repeat(28)), B = await phone('Bob', 'b'.repeat(28));
  await A.goto(U + '#/online'); await A.waitForTimeout(700);
  await A.click('#onew'); await A.waitForTimeout(300); await A.fill('#nname', 'Bob'); await A.click('.ng-game[data-k="hattrick"]');
  ok((await A.textContent('#ngo')).includes('Hat-Trick'), 'Hat-Trick is in New game');
  await A.click('#ngo'); await A.waitForTimeout(1500);
  const code = await A.evaluate(() => location.hash.split('room=')[1]);
  ok(!!code && (await A.$('.ht-pitch')) !== null, 'the challenge opens the Hat-Trick table (' + code + ')');
  await B.goto(U + '#/online?room=' + code); await B.waitForTimeout(1500);
  // Bob (the guest) bids first, then Alice after the computers
  await B.waitForSelector('[data-bid]', { timeout: 6000 }); await B.click('[data-bid="4"]'); await B.click('#ht-place'); await B.waitForTimeout(800);
  await A.waitForTimeout(2600);
  await A.waitForSelector('[data-bid]', { timeout: 8000 }); await A.screenshot({ path: 'lay/hto_bid.png' });
  await A.click('[data-bid="3"]'); await A.click('#ht-place'); await A.waitForTimeout(2600);
  // a few cards each, through the screen
  let plays = 0;
  for (let i = 0; i < 60 && plays < 6; i++) {
    for (const P of [A, B]) {
      const c = await P.$('.ht-hand.go .ht-card.ok');
      if (c) { await c.click({ position: { x: 8, y: 30 } }); await P.waitForTimeout(80); const up = await P.$('.ht-hand .ht-card.up'); if (up) { await up.click({ position: { x: 8, y: 30 } }); plays++; await P.waitForTimeout(700); } }
      else await P.waitForTimeout(400);
    }
  }
  ok(plays >= 6, 'both phones played cards through the screen (' + plays + ')');
  await A.waitForTimeout(2500); await B.waitForTimeout(500);
  await A.screenshot({ path: 'lay/hto_play_alice.png' }); await B.screenshot({ path: 'lay/hto_play_bob.png' });
  const same = async () => {
    const f = P => P.evaluate(() => { const G = GM.hattrickRules.state; return JSON.stringify([G.handNo, G.bids, G.won, G.scores, G.played.length, G.trick.map(t => t.c.id)]); });
    return [await f(A), await f(B)];
  };
  const [sa, sb] = await same();
  ok(sa === sb, 'both phones see the same game: ' + sa);
  // play the rest of the match out quickly, each phone only on its own turn
  const step = P => P.evaluate(async code => {
    const r = await GM.lb.rpc('online_get', { p_code: code, p_user: GM.account().name });
    if (r.status === 'done') return 'done';
    const seat = r.host === GM.account().name ? 'host' : 'guest', R = GM.hattrickRules, out = R.replay(r, seat);
    if (out.bad) return 'bad';
    const me = seat === 'host' ? 0 : 1; if (out.waiting !== me) return 'wait';
    const G = R.state, move = G.phase === 'bid' ? { t: 'b', n: R.cpuBid(me) } : { t: 'p', c: R.cpuPlay(me).id };
    const after = R.replay(r, seat, r.moves.concat({ ...move, s: seat })), W = R.state;
    const res = await GM.lb.rpc('online_move', { p_user: GM.account().name, p_key: GM.account().key, p_code: code, p_seq: r.moves.length, p_move: move, p_sum: null,
      p_turn: W.over ? 'none' : after.waiting === 0 ? 'host' : 'guest', p_all: W.over ? { host: { done: true, t: W.scores[0] }, guest: { done: true, t: W.scores[1] } } : null });
    return res;
  }, code);
  let status = '', n = 0;
  for (; n < 2000; n++) { const a = await step(A), bb = await step(B); if (a === 'done' || bb === 'done') { status = 'done'; break; } if (a === 'bad' || bb === 'bad') { status = 'bad'; break; } }
  ok(status === 'done', `the match reached full time (${n} rounds of turns)`);
  const room = server.rooms[code];
  ok(room && room.status === 'done' && room.result && ['host', 'guest', 'draw'].includes(room.result.winner), 'the server has the result: ' + JSON.stringify(room.result) + ' from ' + JSON.stringify(room.race));
  await A.goto(U + '#/'); await A.goto(U + '#/online?room=' + code); await A.waitForTimeout(2200);
  ok(!!(await A.$('.race-final')), 'Alice sees the final result'); await A.screenshot({ path: 'lay/hto_final.png' });
  await B.goto(U + '#/online?tab=done'); await B.waitForTimeout(1200);
  ok((await B.textContent('#odone')).includes('Hat-Trick'), 'the finished game is listed as a Hat-Trick');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
