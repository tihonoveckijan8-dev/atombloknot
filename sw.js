/**
 * Service Worker для Notes
 * Стратегия: Cache-First для статики, Network-First для API
 */

const CACHE_NAME = 'notes-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/home.svg',
    '/icons/notes.svg',
    '/icons/tasks.svg',
    '/icons/progress.svg',
    '/icons/settings.svg',
    '/icons/search.svg',
    '/icons/add.svg',
    '/icons/more.svg',
    '/icons/delete.svg',
    '/icons/edit.svg',
    '/icons/back.svg',
    '/icons/check.svg',
    '/icons/close.svg',
    '/icons/sun.svg',
    '/icons/moon.svg'
];

// Установка: кэшируем все статические ресурсы
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэширование статических ресурсов');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch(err => {
                console.error('[SW] Ошибка кэширования:', err);
                // Кэшируем по одному, чтобы одна ошибка не ломала всё
                return caches.open(CACHE_NAME).then(cache => {
                    return Promise.allSettled(
                        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
                    );
                });
            })
    );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('[SW] Удаление старого кэша:', k);
                    return caches.delete(k);
                })
            ))
            .then(() => self.clients.claim())
    );
});

// Запросы: Cache-First для статики
self.addEventListener('fetch', event => {
    const { request } = event;

    // Пропускаем не-GET запросы
    if (request.method !== 'GET') return;

    // Пропускаем chrome-extension и другие не-http запросы
    if (!request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) {
                    // Возвращаем из кэша, но обновляем в фоне
                    event.waitUntil(
                        fetch(request).then(response => {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(request, response);
                                });
                            }
                        }).catch(() => {})
                    );
                    return cached;
                }

                // Нет в кэше — загружаем из сети
                return fetch(request).then(response => {
                    // Кэшируем успешные ответы
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Сеть недоступна — возвращаем index.html для навигации
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Офлайн', { status: 503, statusText: 'Offline' });
                });
            })
    );
});
