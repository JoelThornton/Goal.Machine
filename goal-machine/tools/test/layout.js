const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
require('fs').mkdirSync('lay', { recursive: true });  // screenshots go in ./lay
const server = require('./mockserver')();
const U = 'http://localhost:8765/goal-machine/';
const modes = (process.argv[2] || 'chaos:1,ultimate:0,target:0,treble:0,chaos:0,classic:1').split(',');
const sizes = (process.argv[3] || '390x844').split(',').map(x => x.split('x').map(Number));
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await server.attach(ctx); await ctx.route(/transfermarkt|premierleague\.com|wikimedia|wikipedia/, r => r.abort());
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(U); await pg.evaluate(() => { localStorage.setItem('gm:seenVersion', '99'); localStorage.setItem('gm:welcomed', '1'); });
    for (const mh of modes) {
      const [m, hard] = mh.split(':');
      await pg.evaluate(hd => { localStorage.setItem('gm:hard', hd); Object.keys(localStorage).filter(k => k.startsWith('gm:save')).forEach(k => localStorage.removeItem(k)); }, hard === '1' ? 'true' : 'false');
      await pg.goto(U + '#/'); await pg.goto(U + '#/draft?m=' + m); await pg.waitForTimeout(1200);
      const snaps = new Set(), overs = [], clipped = [];
      const snap = async tag => {
        const d = await pg.evaluate(() => {
          const p = document.querySelector('.pitch'), dk = document.querySelector('.dock'), app = document.getElementById('app');
          if (!p) return null;
          const r = p.getBoundingClientRect();
          const clip = [...document.querySelectorAll('.stage .reel')].filter(x => x.scrollHeight > x.clientHeight + 2).length;
          const slotClip = [...document.querySelectorAll('.slot')].filter(x => x.scrollHeight > x.clientHeight + 2).length;
          return { p: Math.round(r.top + scrollY) + '/' + Math.round(r.height), dock: dk ? Math.round(dk.getBoundingClientRect().height) : 0, over: Math.round(app.getBoundingClientRect().bottom + scrollY - innerHeight), clip, slotClip, slot: getComputedStyle(app).getPropertyValue('--slot-h') };
        });
        if (!d) return;
        if (tag === 'pick6' || tag === 'spun6') await pg.screenshot({ path: `lay/mid_${tag}_${pg.viewportSize().width}_${m}${hard === '1' ? 'H' : ''}.png` });
        snaps.add(d.p + ' dock ' + d.dock + ' slot ' + d.slot);
        if (d.over > 0) overs.push(tag + ':' + d.over);
        if (d.clip || d.slotClip) clipped.push(tag + ':' + d.clip + '/' + d.slotClip);
      };
      const act = f => pg.evaluate(f).catch(() => null);
      for (let step = 0; step < 60; step++) {
        await snap('s' + step);
        if (await act(() => !!document.querySelector('.result-total'))) break;
        await act(() => document.querySelectorAll('.modal-wrap').forEach(m => m.remove()));
        if (await act(() => { const mg = document.querySelector('.cm [data-mgr]'); if (mg) { mg.click(); return true; } const cm = document.querySelector('.cm:not(.out)'); if (cm) { cm.click(); return true; } return false; })) { await pg.waitForTimeout(400); continue; }
        if (await act(() => { const b = document.getElementById('spin'); if (b) { b.click(); return true; } return false; })) { await pg.waitForTimeout(1400); await snap('spun' + step); continue; }
        const did = await act(() => {
          const t = document.querySelector('.slot.target'); if (t) { t.click(); return 'place'; }
          const rs = [...document.querySelectorAll('.stage .reel[data-reel]')]; if (!rs.length) return null;
          (rs.find(r => !r.classList.contains('is-wild')) || rs[0]).click(); return 'pick';
        });
        await pg.waitForTimeout(did === 'place' ? 900 : 350); await snap(did + step);
      }
      await pg.screenshot({ path: `lay/stab_${w}_${m}${hard === '1' ? 'H' : ''}.png` });
      console.log(`${w}x${h} ${mh.padEnd(10)} layouts=${snaps.size} ${[...snaps].join(' | ')}  over=${overs.slice(0, 4).join(',') || '-'}  clip=${clipped.slice(0, 4).join(',') || '-'}`);
    }
    await ctx.close();
  }
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
