// sw.js - Verbesserte Version mit automatischem Update
const CACHE_NAME = 'leadcapture-v6';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Installations-Event
self.addEventListener('install', event => {
    console.log('🔄 Service Worker installiert...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache geöffnet');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ Alle Dateien gecached');
                return self.skipWaiting(); // Aktiviert neuen SW sofort
            })
    );
});

// Aktivierungs-Event (alte Caches löschen)
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker aktiviert');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`🗑️ Alter Cache gelöscht: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Alte Caches bereinigt');
            return self.clients.claim(); // Übernimmt sofort die Kontrolle
        })
    );
});

// Fetch-Event (mit Cache-Fallback)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // Cache-Treffer – aber prüfe im Hintergrund auf Updates
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        // Aktualisiere den Cache mit der neuen Version
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Offline – kein Problem, wir haben den Cache
                    });
                    return response;
                }
                // Kein Cache – direkt laden
                return fetch(event.request);
            })
    );
});

// Nachricht vom Main-Thread empfangen (für manuelle Updates)
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Service Worker Update erzwingen
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let reg of registrations) {
            reg.update();   // prüft auf neue sw.js
        }
    });

    // Auf Änderungen lauschen und neu laden
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}


// Klick auf die Benachrichtigung öffnet die App (bzw. holt ein
// bereits offenes Fenster nach vorn)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('/');
        })
    );
});

console.log('✅ Service Worker geladen (Version 6)');
