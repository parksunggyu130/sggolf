// SG골프 서비스워커: 앱 파일은 네트워크 우선(업데이트 반영), 지도 타일·라이브러리는 캐시 우선(오프라인)
const VER = 'sggolf-v1.0.0';
const SHELL = ['./', './index.html', './app.css', './manifest.webmanifest', './data/kr-courses.json',
  './js/core.js', './js/golf.js', './js/osm.js', './js/map.js', './js/views.js', './js/play.js', './js/help.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sggolf-v') && k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = url.hostname === 'server.arcgisonline.com';
  const isLib = url.hostname === 'unpkg.com' || url.hostname.endsWith('googleapis.com') || url.hostname === 'fonts.gstatic.com';
  if (isTile || isLib) {
    e.respondWith(caches.open(isTile ? 'sggolf-tiles' : 'sggolf-lib').then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(VER).then(c => c.put(req, res.clone())); return res; })
    .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
