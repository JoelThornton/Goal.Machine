const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });  // screenshots go in ./lay
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
async function phone(b, name, key, errs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await server.attach(ctx);
  await ctx.route(/transfermarkt|premierleague\.com|wikimedia|wikipedia/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e.message));
  await pg.goto(U); await pg.evaluate(([n, k]) => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); localStorage.setItem('gm:account', JSON.stringify({ name: n, key: k })); }, [name, key]);
  return pg;
}
async function playDraft(pg, tag) {
  for (let step = 0; step < 90; step++) {
    const st = await pg.evaluate(() => {
      document.querySelectorAll('.modal-wrap').forEach(m => m.remove());
      if (document.querySelector('.result-total')) return 'done';
      const sp = document.getElementById('spin'); if (sp) { sp.click(); return 'spin'; }
      const t = document.querySelector('.slot.target'); if (t) { t.click(); return 'place'; }
      const rs = [...document.querySelectorAll('.stage .reel[data-reel]')]; if (!rs.length) return 'wait';
      (rs.find(r => !r.classList.contains('is-wild')) || rs[0]).click(); return 'pick';
    }).catch(() => 'err');
    if (step === 8 && tag) await pg.screenshot({ path: `lay/${tag}.png` });
    if (st === 'done') return true;
    await pg.waitForTimeout(st === 'spin' ? 1300 : 500);
  }
  return false;
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const A = await phone(b, 'Alice', 'a'.repeat(28), errs), B = await phone(b, 'Bob', 'b'.repeat(28), errs);
  for (const kind of ['target', 'chaos']) {
    await A.goto(U + '#/online'); await A.waitForTimeout(900);
    await A.click('#onew'); await A.waitForTimeout(300); await A.fill('#nname', 'Bob'); await A.evaluate(() => { const d = document.querySelector('.ng-more'); if (d) d.open = true; }); await A.click(`.ng-game[data-k="${kind}"]`);
    const desc = await A.$eval(`.ng-game[data-k="${kind}"] small`, e => e.innerText);
    await A.click('#ngo'); await A.waitForTimeout(1500);
    const code = Object.keys(server.rooms).find(c => server.rooms[c].variant === kind);
    const room = server.rooms[code];
    console.log(kind, '| room', room.kind, room.variant, '|', desc.slice(0, 60));
    const hdrA = await A.$eval('.topbar h2', e => e.innerText).catch(() => '?');
    const chaosLook = await A.evaluate(() => document.body.classList.contains('chaos-mode'));
    const targetA = await A.$eval('.counter', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '?');
    console.log('  A sees:', hdrA, '| chaos look', chaosLook, '| counter:', targetA.slice(0, 60));
    await playDraft(A, `race_${kind}_A`);
    await B.goto(U + '#/online?room=' + code); await B.waitForTimeout(1500);
    const targetB = await B.$eval('.counter', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '?');
    console.log('  B counter:', targetB.slice(0, 60));
    await playDraft(B);
    await B.waitForTimeout(1500);
    console.log('  sums host', JSON.stringify({ t: room.race.host.t, d: room.race.host.d, c: room.race.host.c, tg: room.race.host.tg }), 'guest', JSON.stringify({ t: room.race.guest.t, d: room.race.guest.d, c: room.race.guest.c, tg: room.race.guest.tg }));
    console.log('  result', JSON.stringify(room.result));
    await B.goto(U + '#/online?room=' + code + '&v=1'); await B.waitForTimeout(1500);
    console.log('  B compare:', await B.$eval('.cmp-points', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '?'), '|', await B.$eval('.race-final', e => e.innerText).catch(() => '?'));
    await B.screenshot({ path: `lay/race_${kind}_cmp.png` });
    await B.goto(U + '#/online'); await B.waitForTimeout(600);
    console.log('  chaos look after leaving:', await B.evaluate(() => document.body.classList.contains('chaos-mode')));
  }
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
