const CACHE_NAME = 'agroop-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './chuva.html',
  './chuva-manifest.json',
  './campo.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Só intercepta GET. POST/PUT e qualquer outro método passam direto.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Só intercepta http/https. Ignora chrome-extension:, data:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // NUNCA intercepta Firebase, Google APIs ou qualquer domínio externo.
  // Só mexe em requisições do próprio site (mesma origem).
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isHTML) {
    // HTML: tenta a rede primeiro; se falhar, usa o cache; se não houver, erro limpo.
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then(cached =>
            cached || new Response('Offline', { status: 503, statusText: 'Offline' })
          )
        )
    );
    return;
  }

  // Demais recursos da própria origem: cache primeiro, rede como reserva.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
