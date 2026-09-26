// 4.10 features: CHAOS formations, Target percentages, the Players signed filter, feedback, badge categories,
// secret badges and online badges.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
const ok = (c, msg) => { console.log((c ? '✓ ' : '✗ ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await server.attach(ctx);
  await ctx.route(/wikimedia|premierleague|transfermarkt/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.evaluate(() => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); localStorage.setItem('gm:account', JSON.stringify({ name: 'Alice', key: 'a'.repeat(28) })); });
  // CHAOS: different seeds give different shapes, the same seed the same shape
  const shapes = new Set();
  for (let i = 0; i < 12; i++) {
    await pg.goto(U + '#/'); await pg.goto(U + `#/draft?m=chaos&seed=t${i}`); await pg.waitForTimeout(350);
    shapes.add(await pg.$eval('.pitch .shape', e => e.textContent).catch(() => '?'));
  }
  ok(shapes.size >= 3, 'CHAOS formations vary: ' + [...shapes].join(' '));
  await pg.goto(U + '#/'); await pg.goto(U + '#/draft?m=chaos&seed=t1'); await pg.waitForTimeout(350); const a1 = await pg.$eval('.pitch .shape', e => e.textContent);
  await pg.goto(U + '#/'); await pg.goto(U + '#/draft?m=chaos&seed=t1'); await pg.waitForTimeout(350);
  ok(a1 === await pg.$eval('.pitch .shape', e => e.textContent), 'same seed, same formation (' + a1 + ')');
  // Target percentages
  ok(await pg.evaluate(() => GM.pctOf('target', { t: 488, g: 500 }) === '97.6%' && GM.pctOf('targetappsh', { t: 3500 }) === '93.3%' && GM.pctOf('ultimate', { t: 300 }) === ''), 'percentages (and old scores use the old target)');
  // Players: signed filter
  await pg.evaluate(() => localStorage.setItem('gm:album', JSON.stringify({ players: { [GM.players[0].pk]: '2026-09-26' }, ach: {}, days: [] })));
  await pg.goto(U + '#/players'); await pg.waitForTimeout(600); await pg.selectOption('#pown', 'yes'); await pg.waitForTimeout(200);
  ok((await pg.$$('.plist .prow')).length === 1, 'signed filter shows the one signed player');
  // feedback
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400); await pg.click('#s-feedback'); await pg.click('#fb-kind [data-v="idea"]');
  await pg.fill('#fb-text', 'More badges please'); await pg.click('#fb-send'); await pg.waitForTimeout(300);
  const fb = (server.fns._fb || [])[0];
  ok(fb && fb.p_kind === 'idea' && fb.p_body === 'More badges please' && fb.p_name === 'Alice' && fb.p_meta.v, 'feedback sent with version and name');
  // badges: categories, secrets hidden, online badge from a finished game
  await pg.evaluate(() => GM.checkOnline({ code: 'R1', kind: 'race', variant: 'chaos', host: 'Alice', guest: 'Bob', result: { winner: 'host' } }, 'host'));
  await pg.goto(U + '#/album'); await pg.waitForTimeout(600);
  const cats = await pg.$$eval('.ach-cat', e => e.map(x => x.textContent));
  ok(cats.length === 6, 'badge categories: ' + cats.join(' | '));
  ok(await pg.$$eval('.ach.secret b', e => e.every(x => x.textContent === '???')) && (await pg.$$('.ach.secret')).length === 5, 'five secret badges show as ???');
  ok(await pg.$$eval('.ach.got b', e => e.map(x => x.textContent).join()).then(s => /Kick-off/.test(s) && /Away Win/.test(s) && /Chaos Merchant/.test(s)), 'online badges from a won CHAOS Race');
  await pg.screenshot({ path: 'lay/badges.png', fullPage: true });
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
