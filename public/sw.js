// Service worker: file tampilan peserta disimpan di perangkat (cache-first) supaya hemat permintaan ke server.
// Setiap kali ada pembaruan aplikasi, naikkan nomor CACHE di bawah ini (mis. v14 → v15) agar semua perangkat memuat ulang.
const CACHE = 'lcc-v17';
const ASET = ['index.html', 'style.css', 'common.js', 'pasang.js', 'peserta.js', 'manifest.json', 'logo.png', 'logo-495.png', 'logo-bangkalan.png', 'logo-dinas.png', 'data-sekolah.js', 'icon-192.png', 'icon-512.png', 'qfaz-logo.png', 'papan.html', 'papan.js'];
const KUNCI = new Set(ASET.map(a => '/' + a));
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASET.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase, Cloudinary & CDN langsung ke jaringan
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (KUNCI.has(path)) { // file peserta & papan: dari cache dulu (0 permintaan ke server)
    e.respondWith(caches.open(CACHE).then(c => c.match(path.slice(1)).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(path.slice(1), r.clone()); return r; }))));
    return;
  }
  // file lain (admin dll.): jaringan dulu, cadangan dari cache
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
