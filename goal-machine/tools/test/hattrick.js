// 🃏 Hat-Trick: 200 computer-only hands check the rules (legal plays, Legends, a full distinct deck, sensible bids),
// then a hand is played through the real screen (bid, double-tap to play, hand summary).
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 } }); await server.attach(ctx);
  await ctx.route(/wikimedia|premierleague|transfermarkt/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.evaluate(() => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); });
  const sim = await pg.evaluate(() => {
    const R = GM.hattrickRules, out = { hands: 0, bad: [], bids: [], tricksLed: 0, legendLeadEarly: 0, deckOk: true };
    for (let h = 0; h < 200; h++) {
      const stat = ['goals', 'assists', 'apps'][h % 3];
      const hands = R.deal('sim' + h, stat);
      const ids = new Set(hands.flat().map(c => c.id)), pks = new Set(hands.flat().map(c => c.pk));
      if (ids.size !== 52 || pks.size !== 52 || hands.some(x => x.length !== 13)) out.deckOk = false;
      const G = { hard: false, hands, bids: [null, null, null, null], won: [0, 0, 0, 0], trick: [], played: [], broken: false, dealer: 0, turn: 1, phase: 'bid' };
      R.state = G;
      for (let s = 0; s < 4; s++) G.bids[(1 + s) % 4] = R.cpuBid((1 + s) % 4);
      out.bids.push(G.bids.reduce((a, x) => a + x, 0));
      let lead = 1;
      for (let t = 0; t < 13; t++) {
        for (let k = 0; k < 4; k++) {
          const s = (lead + k) % 4, legal = R.legal(s), c = R.cpuPlay(s);
          if (!legal.some(x => x.id === c.id)) out.bad.push(`seat ${s} played illegal ${c.id}`);
          if (k === 0 && c.s === 'L' && !G.broken && G.hands[s].some(x => x.s !== 'L')) out.legendLeadEarly++;
          G.hands[s] = G.hands[s].filter(x => x.id !== c.id);
          if (c.s === 'L') G.broken = true;
          G.trick.push({ seat: s, c });
        }
        const w = R.winning(G.trick);
        // the winner really is the best card: best Legend, else best of the suit led
        const led = G.trick[0].c.s, L = G.trick.filter(x => x.c.s === 'L'), pool = L.length ? L : G.trick.filter(x => x.c.s === led);
        if (pool.sort((a, b2) => b2.c.rank - a.c.rank)[0].seat !== w.seat) out.bad.push('wrong winner');
        G.won[w.seat]++; G.played.push(...G.trick.map(x => x.c)); G.trick = []; lead = w.seat; out.tricksLed++;
      }
      if (G.won.reduce((a, x) => a + x, 0) !== 13) out.bad.push('tricks do not add to 13');
      out.hands++;
    }
    out.avgBid = (out.bids.reduce((a, x) => a + x, 0) / out.bids.length).toFixed(1);
    delete out.bids;
    return out;
  });
  ok(sim.deckOk, 'every deal: 52 different players, 13 each');
  ok(!sim.bad.length, `200 computer hands, every play legal and every trick to the right card ${sim.bad.slice(0, 3).join('; ')}`);
  ok(sim.legendLeadEarly === 0, 'nobody leads a Legend before they’re broken');
  ok(+sim.avgBid >= 8 && +sim.avgBid <= 14, 'sensible table bids (average ' + sim.avgBid + ' of 13)');
  // through the screen
  await pg.goto(U + '#/hattrick'); await pg.waitForTimeout(600); await pg.screenshot({ path: 'lay/ht_menu.png' });
  await pg.click('#ht-play'); await pg.waitForTimeout(400);
  ok((await pg.$$('.ht-hand .ht-card')).length === 13, 'you’re dealt 13 cards');
  await pg.waitForSelector('[data-bid]', { timeout: 8000 }); await pg.screenshot({ path: 'lay/ht_bid.png' });
  ok(await pg.$eval('#ht-place', b => b.disabled), 'Place bid waits for a choice');
  await pg.click('[data-bid="3"]'); await pg.click('#ht-place');
  let plays = 0;
  for (let i = 0; i < 400 && plays < 13; i++) {
    if (await pg.$('.modal .ht-sum')) break;
    const card = await pg.$('.ht-hand.go .ht-card.ok');
    if (card) { await card.click({ position: { x: 8, y: 30 } }); await pg.waitForTimeout(80); const again = await pg.$('.ht-hand .ht-card.up'); if (again) { await again.click({ position: { x: 8, y: 30 } }); plays++; if (plays === 4) await pg.screenshot({ path: 'lay/ht_play.png' }); } }
    await pg.waitForTimeout(250);
  }
  await pg.waitForSelector('.modal .ht-sum', { timeout: 20000 });
  ok(plays === 13, 'played all 13 of your cards by tapping twice');
  await pg.waitForTimeout(600); await pg.screenshot({ path: 'lay/ht_summary.png' });
  const score = await pg.evaluate(() => GM.hattrickRules.state.scores);
  ok(Array.isArray(score) && score.some(x => x !== 0), 'hand scored: ' + score.join(' – '));
  await pg.click('#ht-next'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => GM.hattrickRules.state.handNo === 2 && GM.hattrickRules.state.phase === 'bid'), 'next hand dealt');
  await pg.reload(); await pg.waitForTimeout(800);
  ok(!!(await pg.$('#ht-resume')), 'the menu offers to carry on after closing the app');
  await pg.click('#ht-resume'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => GM.hattrickRules.state.handNo === 2), 'and carries on at hand 2');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
