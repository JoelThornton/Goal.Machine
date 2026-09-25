// Draws the Goal Machine logo (a ball rippling the top corner of the net) and writes every icon the site and the
// Android app use. Run from the repo root after changing the design:  node goal-machine/tools/make_icons.js
// Needs Playwright (only to rasterise the SVG in a headless browser).
const fs = require('fs');
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const GREEN = '#0b3d2e', LIME = '#c8ff3d', WHITE = '#f4f7f2';
const ROOT = path.join(__dirname, '..', '..');
const ICONS = path.join(ROOT, 'goal-machine', 'icons');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const f = n => n.toFixed(1);
const pentagon = (cx, cy, r, rot) => [0, 1, 2, 3, 4].map(i => {
  const a = (rot + 72 * i) * Math.PI / 180;
  return f(cx + r * Math.cos(a)) + ',' + f(cy + r * Math.sin(a));
}).join(' ');

// A classic ball: a centre pentagon, seams out to the rim and five rim patches half hidden by the edge
function ball(cx, cy, R, fill, ink, id) {
  const sw = R * 0.075;
  let s = `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}"/>` +
    `<g clip-path="url(#${id})" stroke="${ink}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round" fill="${ink}">` +
    `<polygon points="${pentagon(cx, cy, R * 0.38, -90)}"/>`;
  for (let i = 0; i < 5; i++) {
    const seam = (-90 + 72 * i) * Math.PI / 180, patch = seam + 36 * Math.PI / 180;
    s += `<polygon points="${pentagon(cx + R * Math.cos(patch), cy + R * Math.sin(patch), R * 0.25, patch * 180 / Math.PI + 180)}"/>` +
      `<line x1="${f(cx + R * 0.38 * Math.cos(seam))}" y1="${f(cy + R * 0.38 * Math.sin(seam))}" x2="${f(cx + R * 1.1 * Math.cos(seam))}" y2="${f(cy + R * 1.1 * Math.sin(seam))}"/>`;
  }
  return s + `</g><circle cx="${cx}" cy="${cy}" r="${f(R - sw / 2)}" fill="none" stroke="${fill}" stroke-width="${f(sw)}"/>`;
}

// The logo itself, centred on (256,256) in a 512 box. `mono` draws it in one colour for Android's themed icons.
function logo(mono) {
  const frame = mono ? '#fff' : LIME, ballFill = mono ? '#fff' : WHITE, ink = mono ? '#000' : GREEN;
  const net = [150, 206, 262, 318, 374].map(x => `<line x1="${x}" y1="140" x2="${x}" y2="416"/>`).join('') +
    [206, 266, 326, 386].map(y => `<line x1="92" y1="${y}" x2="420" y2="${y}"/>`).join('');
  return `<g transform="translate(0 -22)"><g stroke="${frame}" stroke-opacity=".3" stroke-width="7">${net}</g>` +
    `<path d="M84 424V132H428V424" fill="none" stroke="${frame}" stroke-width="34" stroke-linejoin="round" stroke-linecap="round"/>` +
    ball(318, 248, 104, ballFill, ink, 'ball') + '</g>';
}
const scaled = (k, body) => `<g transform="translate(${256 - 256 * k} ${256 - 256 * k}) scale(${k})">${body}</g>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;

const ROUNDED = svg(`<rect width="512" height="512" rx="110" fill="${GREEN}"/>` + logo());          // site + legacy launcher
const MASKABLE = svg(`<rect width="512" height="512" fill="${GREEN}"/>` + scaled(0.78, logo()));   // PWA maskable (80% safe zone)
const FOREGROUND = svg(scaled(0.74, logo()));                                                      // Android adaptive icon layer
const MONO = svg(scaled(0.74, logo(true)));                                                        // Android 13 themed icon layer

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = async (source, size, file, mono) => {
    const b64 = await page.evaluate(async ([src, size, mono]) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(src);
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, size, size);
      if (mono) {  // themed icons only use alpha: white shows, black (the ball's patches) becomes see-through
        const d = x.getImageData(0, 0, size, size);
        for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i + 3] * d.data[i] / 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
        x.putImageData(d, 0, 0);
      }
      return c.toDataURL('image/png').split(',')[1];
    }, [source, size, mono]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  };

  fs.writeFileSync(path.join(ICONS, 'icon.svg'), ROUNDED + '\n');
  await png(ROUNDED, 192, path.join(ICONS, 'icon-192.png'));
  await png(ROUNDED, 512, path.join(ICONS, 'icon-512.png'));
  await png(MASKABLE, 512, path.join(ICONS, 'icon-maskable-512.png'));
  for (const [dpi, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const dir = path.join(RES, 'mipmap-' + dpi);
    await png(ROUNDED, 48 * k, path.join(dir, 'ic_launcher.png'));
    await png(FOREGROUND, 108 * k, path.join(dir, 'ic_launcher_foreground.png'));
    await png(MONO, 108 * k, path.join(dir, 'ic_launcher_monochrome.png'), true);
  }
  await browser.close();
  console.log('icons written');
})();
