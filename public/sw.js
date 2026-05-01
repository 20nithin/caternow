const CACHE_NAME = 'caternow-static-v2';
const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.destination === 'document' &&
      (request.headers.get('accept') || '').includes('text/html'))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Keep cross-origin requests (Supabase, tiles, fonts, CDN, etc.) on browser default network behavior.
  if (url.origin !== self.location.origin) return;

  // Avoid intercepting Vite dev module requests and HMR client paths.
  if (url.pathname.startsWith('/@vite') || url.pathname.startsWith('/src/')) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedPage = await caches.match('/index.html');
          return cachedPage || Response.error();
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetched = fetch(request)
        .then(async (response) => {
          if (response && response.ok && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      return cached || (await fetched) || Response.error();
    })()
  );
});
