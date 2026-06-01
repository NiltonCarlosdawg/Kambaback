const CACHE_NAME = 'kambapro-v2';

// Install: cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for everything so the app does not keep serving an
// offline shell from cache when the local server is stopped.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests: network first, no stale cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(JSON.stringify({
          success: false,
          message: 'Offline',
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))
    );
    return;
  }

  // Everything else: network first, fallback only to a simple offline response
  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === 'navigate') {
        return new Response(
          '<!doctype html><html><body><h1>Offline</h1><p>O servidor local não está disponível.</p></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        );
      }

      return caches.match(request);
    })
  );
});
