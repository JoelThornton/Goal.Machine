const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });  // screenshots go in ./lay
const server = require('./mockserver')();
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const theme of ['light', 'dark', 'club']) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 } }); await server.attach(ctx);
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(theme + ' ' + pg.url() + ': ' + e.message));
    const U = 'http://localhost:8765/goal-machine/';
    await pg.goto(U); await pg.evaluate(t => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); localStorage.setItem('gm:played', '3'); localStorage.setItem('gm:theme', JSON.stringify(t)); localStorage.setItem('gm:club', '"Arsenal"'); localStorage.setItem('gm:account', JSON.stringify({ name: 'Alice', key: 'a'.repeat(28) })); }, theme);
    await pg.reload(); await pg.waitForTimeout(1500);
    if (theme === 'light') console.log('whats new:', await pg.$eval('.whats-new h3', e => e.innerText).catch(() => 'none'));
    for (const r of ['', 'today', 'leaderboard', 'album', 'players', 'settings', 'hattrick', 'settings?s=account', 'settings?s=look', 'settings?s=sound', 'settings?s=notify', 'settings?s=play', 'about', 'updates', 'h2h', 'online', 'footle', 'credits', 'draft?m=ultimate', 'draft?m=classic', 'draft?m=extreme', 'draft?m=target', 'hilo', 'whoami', 'grid', 'tally', 'hopper', 'moneyball', 'moneyball?s=goals', 'moneyball?daily=1', 'window?s=apps', 'auction', 'auction?new=1', 'draft?m=chaos', 'draft?m=club', 'album?s=apps', 'draft?m=chaos&daily=1', 'online']) {
      await pg.goto(U + '#/' + r); await pg.waitForTimeout(700);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (ov) console.log(theme, r, 'horizontal overflow!');
    }
    if (theme === 'club') { await pg.goto(U + '#/settings?s=look'); await pg.waitForTimeout(600); await pg.screenshot({ path: 'lay/settings_club.png', fullPage: true }); }
  }
  console.log(errs.join('\n') || 'no page errors on any page'); await b.close();
})();
