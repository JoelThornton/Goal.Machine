// Makes the Google Play listing graphics: a 1024x500 feature graphic and phone screenshots (1080 wide).
// Serve the repo root locally first (python3 -m http.server 8765), then: node android/store/make_store_assets.js
const fs = require('fs'), path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const U = process.argv[2] || 'http://localhost:8765/goal-machine/', OUT = __dirname;
(async () => {
  const b = await chromium.launch();
  // feature graphic
  const icon = fs.readFileSync(path.join(OUT, '../../goal-machine/icons/icon.svg'), 'utf8');
  const fg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await fg.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap" rel="stylesheet"></head>
    <body style="margin:0;width:1024px;height:500px;display:flex;align-items:center;gap:56px;padding:0 70px;box-sizing:border-box;font-family:Oswald,Impact,sans-serif;
      background:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 24px,transparent 24px 48px),radial-gradient(circle at 25% 40%,#1d7a57,#07261d 70%)">
      <div style="width:300px;height:300px;flex-shrink:0;filter:drop-shadow(0 18px 30px rgba(0,0,0,.45))">${icon.replace('<svg ', '<svg width="300" height="300" ')}</div>
      <div><div style="font-size:112px;line-height:.9;color:#c8ff3d;text-shadow:0 6px 0 #0a2a1f">GOAL</div>
        <div style="font-size:64px;letter-spacing:14px;color:#fff">MACHINE</div>
        <div style="font:600 30px/1.3 Inter,sans-serif;color:#cfe9dc;margin-top:18px">Build the biggest-scoring XI<br>from 5,000+ Premier League players</div></div></body></html>`);
  await fg.waitForTimeout(800);
  await fg.screenshot({ path: path.join(OUT, 'feature-graphic.png') });
  fs.copyFileSync(path.join(OUT, '../../goal-machine/icons/icon-512.png'), path.join(OUT, 'icon-512.png'));
  // screenshots at a 1080x2160 phone size, in the Play version (no PL/Transfermarkt photos)
  const pg = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1080 / 390 });
  await pg.addInitScript(() => { window.AndroidApp = { channel: () => 'play', version: () => 999, share() { } }; });
  await pg.goto(U); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('gm:name', '"Joel"'); localStorage.setItem('gm:seenVersion', '999'); localStorage.setItem('gm:club', '"Liverpool"'); });
  const shot = async (hash, name, prep) => { await pg.goto(U + hash); await pg.waitForTimeout(900); if (prep) await prep(); for (const m of await pg.$$('.modal [data-close]')) { try { await m.click(); } catch (e) { } } await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(OUT, name) }); };
  await shot('#/', 'screenshot-1-home.png');
  await shot('#/draft?m=ultimate&s=goals&seed=store1', 'screenshot-2-draft.png', async () => { await pg.click('#spin'); await pg.waitForTimeout(1500); });
  await shot('#/today', 'screenshot-3-today.png');
  await shot('#/h2h', 'screenshot-4-head-to-head.png');
  await b.close();
  console.log('store assets written to', OUT);
})();
