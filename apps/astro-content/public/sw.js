// Service Worker for Ag & Culture Podcast PWA
const CACHE_NAME = 'ag-culture-podcast-v1';

// Files to cache on install (images now served from Cloudinary CDN)
const PRECACHE_ASSETS = [
  '/podcast/',
  '/manifest.json',
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
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

// Fetch event - network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Only cache podcast-related pages and assets
            if (
              event.request.url.includes('/podcast/') ||
              event.request.url.includes('/images/') ||
              event.request.url.endsWith('.css') ||
              event.request.url.endsWith('.js')
            ) {
              cache.put(event.request, responseClone);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Return cached version if network fails
        return caches.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/podcast/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Handle background sync for offline actions (future use)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

async function syncAnalytics() {
  // Future: Sync offline analytics events
  console.log('Syncing analytics...');
}
