const CACHE = 'converter-v1';

const ASSETS = [
    'converter.html',
    'converter_manifest.json',
    'coordinate_parser.js',
    'geodesy/dms.js',
    'geodesy/latlon-ellipsoidal-datum.js',
    'geodesy/latlon-ellipsoidal.js',
    'geodesy/mgrs.js',
    'geodesy/utm.js',
    'geodesy/vector3d.js',
    'img/icon-192.png',
    'img/icon-512.png',
    'img/favicon-32x32.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Serve from cache, refresh in the background when online.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) {
        return;
    }
    event.respondWith(
        caches.open(CACHE).then(async cache => {
            const cached = await cache.match(req, { ignoreSearch: true });
            const update = fetch(req).then(res => {
                if (res.ok) cache.put(req, res.clone());
                return res;
            });
            if (cached) {
                update.catch(() => {});
                return cached;
            }
            return update;
        })
    );
});
