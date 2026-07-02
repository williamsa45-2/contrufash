/**
 * ConstruFash — Service Worker (SAD DA-03 Offline-First, SRS RNF-01)
 *
 * Estrategia por tipo de recurso:
 *   - Activos estaticos (CSS, JS, fonts): Cache-First
 *     → Si esta en cache, lo sirve al instante; actualiza en background.
 *   - Paginas HTML (paneles): Network-First con fallback a cache
 *     → Intenta la red; si falla, sirve la version cacheada.
 *   - API (/api/*): Network-Only
 *     → Nunca cachear respuestas de API; el cliente maneja offline via Dexie.js.
 *   - Imagenes Cloudinary: Cache-First con limite de 50 entradas / 7 dias.
 */

const CACHE_VERSION = 'construfash-v2.3.0';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_PAGES   = `${CACHE_VERSION}-pages`;
const CACHE_IMAGES  = `${CACHE_VERSION}-images`;

// Recursos a pre-cachear en la instalacion
const STATIC_ASSETS = [
  '/css/styles.css',
  '/js/app.js',
  '/js/auth-client.js',
  '/js/offline.js',
  '/login',
];

/* =========================================================================
   INSTALL — Pre-cachear activos estaticos esenciales
   ========================================================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] No se pudo pre-cachear algunos activos:', err);
      });
    })
  );
  self.skipWaiting();
});

/* =========================================================================
   ACTIVATE — Limpiar caches de versiones anteriores
   ========================================================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k.startsWith('construfash-') && ![CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES].includes(k))
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* =========================================================================
   FETCH — Estrategia por tipo de recurso
   ========================================================================= */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones al mismo origen + Cloudinary para imagenes
  const esPropio = url.origin === self.location.origin;
  const esCloudinary = url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary.com');

  if (!esPropio && !esCloudinary) return;

  // API: Network-Only (el fallback offline lo gestiona Dexie.js en el cliente)
  if (esPropio && url.pathname.startsWith('/api/')) {
    return; // dejar pasar sin interceptar
  }

  // Socket.io: Network-Only
  if (esPropio && url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Imagenes Cloudinary: Cache-First con TTL de 7 dias
  if (esCloudinary) {
    event.respondWith(cacheFirstConLimite(request, CACHE_IMAGES, 50));
    return;
  }

  // Activos estaticos (CSS/JS/fonts): Cache-First
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/img/') ||
    url.pathname.includes('fonts.googleapis.com') ||
    url.pathname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Paginas HTML: Network-First con fallback a cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstConCache(request, CACHE_PAGES));
    return;
  }

  // Default: Network con cache de respaldo
  event.respondWith(networkFirstConCache(request, CACHE_STATIC));
});

/* =========================================================================
   ESTRATEGIAS
   ========================================================================= */

/** Cache-First: sirve desde cache; si no esta, va a red y guarda. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Sin conexion y sin cache para este recurso.', { status: 503 });
  }
}

/** Cache-First con limite de entradas. Elimina la mas antigua si supera el maximo. */
async function cacheFirstConLimite(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // Limpiar entradas viejas
      const keys = await cache.keys();
      if (keys.length > maxEntries) {
        cache.delete(keys[0]);
      }
    }
    return response;
  } catch {
    return new Response('Sin conexion.', { status: 503 });
  }
}

/** Network-First: intenta la red; si falla sirve cache; si no hay cache, offline page. */
async function networkFirstConCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback: pagina de login cacheada o mensaje generico
    const loginCache = await caches.match('/login');
    if (loginCache) return loginCache;
    return new Response(
      `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Sin conexion — ConstruFash</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1c1f23;color:#fff;}
      .box{text-align:center;padding:32px;}h1{color:#e8590c;}p{color:#9ca3af;}</style></head>
      <body><div class="box"><h1>Sin conexion</h1>
      <p>No hay red disponible y esta pagina no esta en cache.</p>
      <p>Los datos de asistencia guardados se sincronizaran cuando vuelvas a conectarte.</p>
      </div></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/* =========================================================================
   BACKGROUND SYNC — Reintento de sincronizacion de asistencia offline
   (si el navegador soporta Background Sync API)
   ========================================================================= */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-asistencia') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ tipo: 'sync-asistencia' });
        });
      })
    );
  }
});
