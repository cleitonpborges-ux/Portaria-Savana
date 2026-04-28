// =====================================================
//  SERVICE WORKER — Portaria Savana PWA
//  Estratégia: Cache First para assets, Network First
//  para o index.html (garante atualização automática)
// =====================================================

const CACHE_NAME = 'portaria-savana-v1';

// Arquivos que ficam em cache para funcionar offline
const ASSETS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Ícones
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// URLs externas que também queremos cachear (Tesseract, Firebase)
const EXTERNAL_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js',
];

// ── INSTALL: pré-carrega os assets principais ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Instalando cache...');
      // Cacheia assets locais (falha silenciosa por item)
      return Promise.allSettled(
        [...ASSETS_CACHE, ...EXTERNAL_CACHE].map(url =>
          cache.add(url).catch(e => console.warn('[SW] Não cacheou:', url, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia por tipo de recurso ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase (Firestore/RTDB): sempre Network — nunca cachear dados ao vivo
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // API Anthropic (OCR): sempre Network
  if (url.hostname.includes('anthropic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // index.html: Network First — atualiza quando online, fallback cache
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tudo mais (JS, CSS, imagens, ícones): Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Só cacheia respostas válidas
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline e não tem cache — retorna página de erro mínima
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MENSAGEM: força atualização do SW ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
