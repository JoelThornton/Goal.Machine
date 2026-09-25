// Offline support: cache the app shell, network-first so updates show up on the next load.
const CACHE = 'goal-machine-v13';
const SHELL = ['./', 'index.html', 'style.css', 'config.js', 'data/players.js', 'data/photos.js', 'js/core.js', 'js/audio.js', 'js/draft.js', 'js/report.js', 'js/collection.js', 'js/modes.js', 'js/h2h.js', 'js/updates.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' makes the browser check with GitHub Pages every time (cheap 304s), so a new deploy shows up at once
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
