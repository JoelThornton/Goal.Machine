/* Goal Machine – a shareable picture of your XI (1080×1350, Instagram-shaped).
   Drawn on a canvas: the pitch in a 4-4-2, each player as a badge in his club's colours with his name and tally, and
   the total. Photos aren't drawn (images from other sites can't be exported from a canvas). Shared through the
   Android app's share sheet, the phone's share menu, or downloaded as a file. */
'use strict';

(function () {
  const W = 1080, H = 1350;
  // where each formation slot sits on the pitch (fractions of the pitch area), GK at the bottom
  const SPOTS = { GK: [[0.5, 0.855]], LB: [[0.12, 0.64]], CB: [[0.37, 0.67], [0.63, 0.67]], RB: [[0.88, 0.64]],
    LM: [[0.12, 0.4]], CM: [[0.37, 0.43], [0.63, 0.43]], RM: [[0.88, 0.4]], ST: [[0.36, 0.17], [0.64, 0.17]] };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fit(c, text, max, size, weight = 800, family = 'Inter, Arial, sans-serif') {
    let s = size;
    do { c.font = `${weight} ${s}px ${family}`; s -= 2; } while (c.measureText(text).width > max && s > 12);
  }

  /* xi: [{ pos, p (player), v (the number to show, or null) }]; opts: { title, sub, total, totalLabel, foot } */
  GM.teamPicture = function (xi, opts = {}) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // background + header
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b3d2e'); bg.addColorStop(1, '#07261d');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#c8ff3d'; c.font = '700 64px Oswald, Impact, sans-serif'; c.fillText('GOAL MACHINE', W / 2, 92);
    c.fillStyle = '#ffffff'; fit(c, opts.title || 'My XI', W - 120, 44); c.fillText(opts.title || 'My XI', W / 2, 150);
    if (opts.sub) { c.fillStyle = 'rgba(255,255,255,.7)'; fit(c, opts.sub, W - 120, 30, 600); c.fillText(opts.sub, W / 2, 192); }
    // pitch
    const px = 40, py = 225, pw = W - 80, ph = 900;
    c.save(); roundRect(c, px, py, pw, ph, 28); c.clip();
    for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#1f8a4c' : '#23994f'; c.fillRect(px, py + i * ph / 10, pw, ph / 10); }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4;
    c.strokeRect(px + 20, py + 20, pw - 40, ph - 40);
    c.beginPath(); c.moveTo(px + 20, py + ph / 2); c.lineTo(px + pw - 20, py + ph / 2); c.stroke();
    c.beginPath(); c.arc(W / 2, py + ph / 2, 90, 0, Math.PI * 2); c.stroke();
    c.strokeRect(W / 2 - 200, py + ph - 20 - 150, 400, 150); c.strokeRect(W / 2 - 200, py + 20, 400, 150);
    c.restore();
    // players
    const used = {};
    xi.forEach(s => {
      const spots = SPOTS[s.pos] || [[0.5, 0.5]], k = used[s.pos] = (used[s.pos] || 0), [fx, fy] = spots[Math.min(k, spots.length - 1)];
      used[s.pos]++;
      const x = px + fx * pw, y = py + fy * ph;
      if (!s.p) {
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x, y, 52, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '800 30px Inter, Arial, sans-serif'; c.fillText(s.pos, x, y + 10);
        return;
      }
      const [, cb, cf] = GM.CLUB[s.p.clubs[s.p.clubs.length - 1]] || [0, '#334', '#fff'];
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x, y + 6, 56, 0, Math.PI * 2); c.fill();
      c.fillStyle = cb; c.beginPath(); c.arc(x, y, 56, 0, Math.PI * 2); c.fill();
      c.lineWidth = 6; c.strokeStyle = cf; c.stroke();
      c.fillStyle = cf; c.font = '800 38px Inter, Arial, sans-serif'; c.fillText(GM.initials(s.p.name), x, y + 13);
      if (s.v != null) {  // the tally in a lime tag
        const t = Math.round(s.v).toLocaleString();
        c.font = '800 28px Inter, Arial, sans-serif';
        const tw = c.measureText(t).width + 22;
        c.fillStyle = '#c8ff3d'; roundRect(c, x + 26, y - 70, tw, 40, 20); c.fill();
        c.fillStyle = '#0a2a1f'; c.fillText(t, x + 26 + tw / 2, y - 40);
      }
      const surname = s.p.name.split(' ').slice(-1)[0];
      c.font = '800 30px Inter, Arial, sans-serif';
      const nw = Math.min(250, c.measureText(surname).width + 26);
      c.fillStyle = 'rgba(7,38,29,.85)'; roundRect(c, x - nw / 2, y + 64, nw, 44, 12); c.fill();
      c.fillStyle = '#ffffff'; fit(c, surname, 224, 30); c.fillText(surname, x, y + 96);
    });
    // total + footer
    if (opts.total != null) {  // "312 goals", centred, in two fonts
      const n = Math.round(opts.total).toLocaleString(), label = opts.totalLabel || '';
      c.font = '700 96px Oswald, Impact, sans-serif'; const w1 = c.measureText(n).width;
      c.font = '800 40px Inter, Arial, sans-serif'; const w2 = label ? c.measureText(label).width + 18 : 0;
      const x0 = W / 2 - (w1 + w2) / 2;
      c.textAlign = 'left';
      c.fillStyle = '#ffffff'; c.font = '700 96px Oswald, Impact, sans-serif'; c.fillText(n, x0, 1250);
      if (label) { c.fillStyle = '#c8ff3d'; c.font = '800 40px Inter, Arial, sans-serif'; c.fillText(label, x0 + w1 + 18, 1250); }
      c.textAlign = 'center';
    }
    c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 26px Inter, Arial, sans-serif';
    c.fillText(opts.foot || 'opportunisticgames.github.io/goal-machine', W / 2, 1310);
    return cv.toDataURL('image/png');
  };

  // Share a picture: the Android app's share sheet (build 13+), the phone's share menu, or a download
  GM.shareImage = async function (png, text) {
    if (window.AndroidApp && typeof AndroidApp.shareImage === 'function') { AndroidApp.shareImage(png, text || ''); return; }
    try {
      const blob = await (await fetch(png)).blob(), file = new File([blob], 'goal-machine.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = png; a.download = 'goal-machine.png';
    document.body.appendChild(a); a.click(); a.remove();
    GM.toast('🖼️ Picture saved to your downloads');
  };
})();
