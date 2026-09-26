// Reel cards fit at any text size (FS=130% node cards.js mimics a phone with bigger text): a two-line name and a
// Rotation Risk wildcard, and nothing may spill out of the card or have its text cut short. Screenshots in ./lay
require('fs').mkdirSync('lay', { recursive: true });
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) for (const m of ['chaos', 'ultimate']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await server.attach(ctx); await ctx.route(/transfermarkt|premierleague\.com|wikimedia|wikipedia/, r => r.abort());
    const pg = await ctx.newPage();
    await pg.goto(U); await pg.evaluate(() => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); });
    await pg.goto(U + '#/draft?m=' + m); await pg.waitForTimeout(300); await pg.addStyleTag({ content: 'html{font-size:' + (process.env.FS||'100%') + '}' }); await pg.waitForTimeout(700);
    await pg.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
    await pg.evaluate(() => { const mg = document.querySelector('.cm [data-mgr]'); if (mg) mg.click(); }); await pg.waitForTimeout(400);  // CHAOS: appoint a manager
    await pg.click('#spin').catch(() => {}); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(x => x.remove()));
    const res = await pg.evaluate(() => {
      const out = [];
      const reels = [...document.querySelectorAll('.stage .reel')];
      const probe = (r, tag) => { const rb = r.getBoundingClientRect(), bw = parseFloat(getComputedStyle(r).borderBottomWidth); const bad = [...r.querySelectorAll('*')].filter(e => e.offsetParent && e.getBoundingClientRect().bottom > rb.bottom - bw + 0.5).map(e => e.className + ' +' + Math.round(e.getBoundingClientRect().bottom - rb.bottom + bw)); const d = r.querySelector('.wild-desc'); if (d && d.scrollHeight > d.clientHeight + 1) bad.push('wild-desc clamped ' + d.scrollHeight + '>' + d.clientHeight); if (bad.length) out.push(tag + ': ' + [...new Set(bad)].slice(0, 4).join(', ')); };
      const r0 = reels[0]; const nm = r0.querySelector('.reel-name'); if (nm) nm.textContent = 'Abdoulaye Diagne-Faye Longname';
      reels[1].classList.add('is-wild'); reels[1].innerHTML = '<div class="wild-card"><div class="wild-icon">🩹</div><div class="wild-name">Rotation Risk</div><div class="wild-desc">Your next signing’s goals count half (rounded down).</div><div class="tag">WILDCARD</div></div>';
      window.dispatchEvent(new Event('resize'));
      reels.forEach((r, i) => probe(r, 'card' + i + '[' + r.className.replace(/reel|landed|is-wild/g, '').trim() + ']'));
      return out.concat('reelH ' + Math.round(reels[0].getBoundingClientRect().height));
    });
    const bad = res.length > 1; if (bad) process.exitCode = 1; console.log((bad ? '✗ ' : '✓ ') + w + 'x' + h + ' ' + m + (bad ? ': ' + res.slice(0, -1).join(' | ') : ' – every card fits'));
    await pg.screenshot({ path: `lay/cards_${m}_${w}.png` });
    await ctx.close();
  }
  await b.close();
})();
