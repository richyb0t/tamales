/* Service worker · Tamales (PWA)
 *
 * - Páginas (navegación) y archivos propios /css y /js: RED PRIMERO. Así una versión nueva se ve al abrir;
 *   con mala señal (3 s) o sin red se usa la copia guardada.
 * - Resto (íconos, fuentes, SDK de Firebase): CACHÉ PRIMERO y se actualiza en segundo plano.
 *
 * Al cambiar la lista de archivos o la lógica, sube el número de CACHE_VERSION. */

const CACHE_VERSION = 'tamales-v59';
const NETWORK_TIMEOUT_MS = 3000;

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/boot/theme-init.js',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/css/tokens.css',
  '/css/base.css',
  '/css/controls.css',
  '/css/surfaces.css',
  '/css/shell.css',
  '/css/overlays.css',
  '/css/login.css',
  '/css/sales.css',
  '/css/admin.css',
  '/css/orders.css',
  '/css/motion.css',
  '/css/responsive.css',
  '/js/core/constants.js',
  '/js/core/utils.js',
  '/js/core/state.js',
  '/js/domain/inventory.js',
  '/js/ui/feedback.js',
  '/js/core/render.js',
  '/js/core/session.js',
  '/js/features/auth.js',
  '/js/features/users.js',
  '/js/features/branch-claim.js',
  '/js/features/audit-log.js',
  '/js/features/sales.js',
  '/js/features/history.js',
  '/js/features/cash-cut.js',
  '/js/features/transfers.js',
  '/js/features/dashboard.js',
  '/js/features/inventory-admin.js',
  '/js/features/voice-fill.js',
  '/js/features/settings.js',
  '/js/features/nav-settings.js',
  '/js/features/flavors.js',
  '/js/features/requests.js',
  '/js/features/alerts.js',
  '/js/features/reservations.js',
  '/js/features/reservations-admin.js',
  '/js/features/deliveries.js',
  '/js/ui/layout.js',
  '/js/ui/views.js',
  '/js/reports/data.js',
  '/js/reports/stats.js',
  '/js/reports/charts.js',
  '/js/reports/export.js',
  '/js/reports/analysis.js',
  '/js/reports/view.js',
  '/js/app/events.js',
  '/js/app/history-nav.js',
  '/js/app/password-toggle.js',
  '/js/app/request-bar.js',
  '/js/app/view-restore.js',
  '/js/app/sync-indicator.js',
  '/js/app/pwa.js',
  '/js/ui/modal-animation.js',
  '/js/ui/visual-layer.js',
  '/js/ui/swipe-menu.js',
  '/js/ui/theme-toggle.js',
  '/js/app/boot.js',
  '/js/firebase.js',
];

const isExternalAsset = host => /(^|\.)gstatic\.com$/.test(host) || host === 'fonts.googleapis.com';
const isAppFile = url => url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/');

/* Instalación tolerante: si un recurso falla, el resto se guarda igual y el SW sí se instala */
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/* Red primero con límite de espera. cacheKey: dónde se guarda la copia; fallbacks: qué copia usar si no hay red */
function networkFirst(event, request, cacheKey, fallbacks) {
  const network = fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(cacheKey, copy));
    }
    return response;
  });
  event.waitUntil(network.catch(() => {}));
  const timeout = new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS));
  event.respondWith(
    Promise.race([network, timeout]).catch(async () => {
      for (const key of fallbacks) {
        const cached = await caches.match(key);
        if (cached) return cached;
      }
      return Response.error();
    })
  );
}

/* Caché primero y se actualiza en segundo plano */
function cacheFirst(event, request) {
  event.respondWith(
    caches.open(CACHE_VERSION).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque'))
          cache.put(request, response.clone());
        return response;
      });
      event.waitUntil(network.catch(() => {}));
      return cached || network.catch(() => Response.error());
    })
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    !(url.origin === location.origin || isExternalAsset(url.hostname))
  )
    return;

  if (request.mode === 'navigate') return networkFirst(event, request, '/', ['/', '/index.html']);
  if (url.origin === location.origin && isAppFile(url))
    return networkFirst(event, request, request, [request]);
  cacheFirst(event, request);
});
