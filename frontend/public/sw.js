/**
 * LifeReceipt Progressive Web App Service Worker
 * Phase 18: Mobile / PWA Experience
 * 
 * SECURITY & PRIVACY POLICY:
 * - Pre-caches static application shell assets for fast loading.
 * - STRICT NON-CREDENTIAL / NON-API CACHING:
 *   Explicitly bypasses any '/api/*' requests.
 *   User ownership data, auth tokens, receipts, and sensitive documents are NEVER stored
 *   in the service worker cache to ensure complete tenant data isolation.
 */

const CACHE_NAME = 'lifereceipt-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// 1. Install: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-cache asset warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate: Purge obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('lifereceipt-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch: Safe routing strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // STRICT RULE 1: Never cache API requests, authentication routes, or file uploads/downloads
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return; // Allow standard network fetch without service worker interception
  }

  // STRICT RULE 2: Non-GET requests must never be cached
  if (request.method !== 'GET') {
    return;
  }

  // Handle SPA Navigation requests (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;
        const cachedRoot = await caches.match('/');
        if (cachedRoot) return cachedRoot;
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LifeReceipt Offline</title></head><body style="background:#020617;color:#94a3b8;font-family:sans-serif;padding:2rem;text-align:center;"><h2 style="color:#f8fafc">You are offline</h2><p>Some LifeReceipt features require an active internet connection to securely query your encrypted vault.</p><button onclick="window.location.reload()" style="background:#0284c7;color:#fff;border:none;padding:0.6rem 1.2rem;border-radius:0.5rem;cursor:pointer;">Retry Connection</button></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Handle Static Shell Assets (Scripts, Styles, Fonts, Icons)
  // Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
