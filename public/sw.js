// Service worker mínimo: deja la app utilizable sin conexión (p. ej. en el gimnasio).
// Los ficheros de /assets/ llevan hash en el nombre, así que se sirven de caché sin preguntar;
// el resto va primero a la red y cae a la caché si no hay conexión.
const CACHE = 'suite-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Turso y demás: directo a la red

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (url.pathname.includes('/assets/')) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req)) || (req.mode === 'navigate' && (await cache.match('./'))) || Response.error();
    }
  })());
});
