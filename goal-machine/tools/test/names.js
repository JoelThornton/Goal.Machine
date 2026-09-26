// Name moderation and the Play version: reporting a name on the boards, a rude name refused, a hidden name asked to
// change (keeping the account), and no Soundtrack option in the Play app.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const open = async (play) => {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 } }); await server.attach(ctx);
    await ctx.route('**/rest/v1/best_scores**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: 'Bob', score: 500 }, { name: 'Alice', score: 400 }]) }));
    await ctx.route(/wikimedia|premierleague|transfermarkt/, r => r.abort());
    if (play) await ctx.addInitScript(() => { window.AndroidApp = { channel: () => 'play', version: () => 99 }; });
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(U); await pg.evaluate(() => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); localStorage.setItem('gm:bg', '"tunes"'); });
    return pg;
  };
  // claim flow refuses a rude name
  server.fns.claim_name({ p_username: 'Alice', p_key: 'a'.repeat(28) });
  server.fns.claim_name({ p_username: 'Bob', p_key: 'b'.repeat(28) });
  let pg = await open(false);
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(600);
  await pg.click('#s-name'); await pg.fill('.claim input', 'shithead'); await pg.click('.claim .btn:not(.ghost)'); await pg.waitForTimeout(300);
  ok((await pg.textContent('.claim-msg')).includes('isn’t allowed'), 'rude name refused');
  await pg.fill('.claim input', 'Dani'); await pg.click('.claim .btn:not(.ghost)'); await pg.waitForTimeout(300);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('gm:account'))).name === 'Dani', 'claimed Dani');
  ok(await pg.$('#s-bg [data-v="tunes"], #s-bg button:has-text("Soundtrack")') !== null, 'web keeps the Soundtrack option');
  // report Bob from the board
  await pg.goto(U + '#/leaderboard?m=ultimate'); await pg.waitForTimeout(800);
  ok((await pg.$$('.lb-row[data-name]')).length === 2, 'other names can be reported');
  await pg.click('#global .lb-row[data-name="Bob"]'); await pg.click('[data-yes]'); await pg.waitForTimeout(300);
  ok(server.fns.report_name({ p_user: 'Alice', p_key: 'a'.repeat(28), p_target: 'Bob' }) === 'ok', 'Dani + Alice reported Bob');
  await pg.screenshot({ path: 'lay/names_board.png', fullPage: true });
  // Bob's name is hidden: he's asked to change it and keeps his account
  server.hiddenNames.add('Bob');
  await pg.evaluate(() => localStorage.setItem('gm:account', JSON.stringify({ name: 'Bob', key: 'b'.repeat(28) })));
  await pg.goto(U + '#/about'); await pg.reload(); await pg.goto(U + '#/leaderboard?m=ultimate'); await pg.waitForTimeout(800);
  ok(await pg.$('#lbhidden .banner') !== null, 'hidden name gets a banner');
  await pg.click('#hn-change'); await pg.fill('.claim input', 'Bobby'); await pg.click('.claim .btn:not(.ghost)'); await pg.waitForTimeout(400);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('gm:account'))).name === 'Bobby' && !server.hiddenNames.has('Bob'), 'renamed to Bobby, same key');
  ok(await pg.$('#lbhidden .banner') === null, 'banner gone after the rename');
  await pg.close();
  // the Play app: no Soundtrack, and a saved Soundtrack choice falls back to the game's music
  pg = await open(true);
  await pg.goto(U + '#/settings'); await pg.reload(); await pg.waitForTimeout(800);
  ok(!(await pg.textContent('#app')).includes('Soundtrack'), 'Play: no Soundtrack in Settings');
  ok(await pg.evaluate(() => GM.sound.settings().bg) === 'music', 'Play: saved Soundtrack becomes game music');
  await pg.goto(U + '#/about'); await pg.waitForTimeout(500);
  ok(!(await pg.textContent('#app')).includes('Epidemic'), 'Play: no Soundtrack credits on About');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
