// Lumina service worker: lets the app install on phones and open quickly.
// Pages: network first, cached copy when offline. API calls are never cached.
const CACHE = 'albayan-v6';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/lib/chem.js', '/lib/plans.js', '/lib/katex/katex.min.css'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin')) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
