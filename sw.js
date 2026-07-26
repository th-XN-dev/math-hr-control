const CACHE = 'jony-kids-v3';
const ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Ilova qo'lda "Yangilash" bosganda — kutayotgan SW darhol faollashadi
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (!url.startsWith('http')) return;
  // Supabase va boshqa API so'rovlarini hech qachon keshlamaymiz (har doim tarmoqdan)
  if (url.includes('supabase') || url.includes('/rest/') || url.includes('/auth/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.method !== 'GET') { e.respondWith(fetch(e.request)); return; }

  // HTML (index.html va navigatsiya) — NETWORK-FIRST: yangi versiya darhol ko'rinadi.
  // Tarmoq bo'lmasa keshdan ishlaydi (offline).
  const isHTML = e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Boshqa fayllar (rasm, ikonka) — CACHE-FIRST (tez)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (!res || res.status !== 200 || res.type === 'opaque') return res;
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('push', e => {
  let data = { title: 'JONY MATH', body: 'Yangi bildirishnoma' };
  try { if (e.data) data = e.data.json(); } catch(_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: './icon-192.png', badge: './icon-192.png', vibrate: [100, 50, 100]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
