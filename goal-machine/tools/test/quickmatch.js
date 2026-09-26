// 🎲 Quick match: Alice waits for a Hat-Trick, Bob taps Quick match and is paired with her; nobody joins Cara, so after a
// minute she's offered the computer and lands in a game (a Live Race falls back to a solo draft, Hat-Trick to the computers).
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
  const quick = async (P, kind) => {
    await P.goto(U + '#/online?tab=games'); await P.waitForTimeout(800);
    await P.click('#oqm'); await P.waitForTimeout(300); await P.click(`.ng-game[data-k="${kind}"]`); await P.click('#qgo'); await P.waitForTimeout(1500);
    return P.evaluate(() => location.hash.split('room=')[1]);
  };
  const A = await phone('Alice', 'a'.repeat(28)), B = await phone('Bob', 'b'.repeat(28)), C = await phone('Cara', 'c'.repeat(28)), D = await phone('Dani', 'd'.repeat(28));
  const codeA = await quick(A, 'hattrick');
  ok(!!(await A.$('.qm-wait')) && /0:0\d/.test(await A.textContent('#qm-t')), 'Alice is finding an opponent, with a clock running');
  ok(await A.$eval('#qm-cpu', e => e.hidden), 'the computer offer waits for a minute');
  await A.screenshot({ path: 'lay/qm_wait.png' });
  const codeB = await quick(B, 'hattrick');
  ok(codeA && codeA === codeB, 'Bob’s Quick match joins Alice’s game (' + codeB + ')');
  await A.waitForTimeout(2500);
  ok(!(await A.$('.qm-wait')) && (await A.textContent('.ht-pitch')).includes('Bob'), 'Alice’s table now shows Bob');
  await A.goto(U + '#/online?tab=friends'); await A.waitForTimeout(1000);
  ok(!(await A.textContent('#ofriends')).includes('Bob'), 'a stranger isn’t added to your friends');
  // a Live Race starts straight away: you build your XI now and whoever joins races your score
  const codeC = await quick(C, 'race');
  ok(!!codeC && !!(await C.$('.pitch')) && !(await C.$('.qm-wait')), 'a Live Race quick match lets you start building your XI at once');
  // nobody about for a turn-by-turn game: after a minute, the computer
  const codeE = await quick(C, 'duel');
  server.rooms[codeE].created = new Date(Date.now() - 70000).toISOString();
  await C.reload(); await C.waitForTimeout(2200);
  ok(!(await C.$eval('#qm-cpu', e => e.hidden)), 'Draft Duel: after a minute with nobody about, the computer is offered');
  await C.screenshot({ path: 'lay/qm_cpu.png' });
  await C.click('#qm-play'); await C.waitForTimeout(1200);
  ok((await C.evaluate(() => location.hash)).startsWith('#/draft?m=ultimate') && !server.rooms[codeE], 'it falls back to a draft, and the waiting game is cancelled');
  const codeD = await quick(D, 'hattrick');
  server.rooms[codeD].created = new Date(Date.now() - 70000).toISOString();
  await D.reload(); await D.waitForTimeout(2200); await D.click('#qm-play'); await D.waitForTimeout(1000);
  ok((await D.evaluate(() => location.hash)) === '#/hattrick' && !!(await D.$('.ht-pitch')), 'a Hat-Trick falls back to a game against the computers');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
