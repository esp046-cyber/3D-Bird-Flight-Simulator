const CACHE_NAME = 'skysoar-ultra-v4'; // Incremented version

// Core assets required for the game to run
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './js/game.js',
    './js/i18n.js'
];

// External assets (Three.js)
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js'
];

// 1. INSTALL: Robust Caching Strategy
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Take control immediately

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Caching Core Assets');
            
            // Strategy: Cache Core Assets first (Critical)
            await cache.addAll(CORE_ASSETS);

            // Strategy: Attempt to cache External Assets, but don't fail install if they error
            // This prevents the game from breaking if CDN is temporarily down during install
            return Promise.allSettled(
                EXTERNAL_ASSETS.map(url => 
                    fetch(url).then(res => {
                        if (res.ok) return cache.put(url, res);
                    })
                )
            );
        })
    );
});

// 2. ACTIVATE: Cleanup & Navigation Preload
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Enable Navigation Preload (Faster boot time)
            self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve(),
            
            // Delete old caches
            caches.keys().then((keyList) => {
                return Promise.all(
                    keyList.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log('[SW] Cleaning old cache:', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
    return self.clients.claim();
});

// 3. FETCH: Hybrid Strategy
self.addEventListener('fetch', (event) => {
    // Ignore non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // STRATEGY A: For Navigation (HTML), try Network first, fall back to Cache
    // This ensures the user always gets the latest index.html if online
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Try Navigation Preload first
                    const preloadResponse = await event.preloadResponse;
                    if (preloadResponse) return preloadResponse;

                    // Try Network
                    const networkResponse = await fetch(event.request);
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (error) {
                    // Network failed, return cached index.html
                    console.log('[SW] Offline mode: Serving index.html');
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match('./index.html');
                    return cachedResponse;
                }
            })()
        );
        return;
    }

    // STRATEGY B: Stale-While-Revalidate for Assets (CSS, JS, Images)
    // Serve cache immediately (fast), update in background
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    // Check if response is valid
                    if(networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch((err) => {
                    console.log('[SW] Network fetch failed for:', event.request.url);
                });

            // Return cached response if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});