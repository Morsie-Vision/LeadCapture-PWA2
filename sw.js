// Cache only the public, same-origin app shell. Navigations prefer fresh HTML.
const CACHE_NAME = 'leadcapture-v9';
const urlsToCache = ['./', './index.html', './manifest.json', './integrity.js',
    './icons/app-icon-192.png', './icons/app-icon-512.png', './icons/apple-touch-icon.png',
    './icons/icon-map.svg', './icons/icon-questionnaire.png', './icons/icon-scan.png', './icons/icon-stats.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache))
        .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(names
        .filter(name => name.startsWith('leadcapture-') && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
        .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    const shellUrls = urlsToCache.map(path => new URL(path, self.registration.scope).href);
    // Authenticated routes and arbitrary same-origin pages must never enter this cache.
    if (!shellUrls.includes(url.origin + url.pathname)) return;
    const cacheKey = url.origin + url.pathname;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request, { cache: 'no-cache' });
            if (response.ok) {
                await cache.put(cacheKey, response.clone());
                return response;
            }
            return (await cache.match(cacheKey)) || response;
        } catch (error) {
            const cached = await cache.match(cacheKey);
            if (cached) return cached;
            throw error;
        }
    })());
});
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const client of list) if ('focus' in client) return client.focus();
        if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    }));
});
