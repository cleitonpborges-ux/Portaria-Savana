const CACHE_NAME = 'portaria-savana-v1';

// Assets do app que devem funcionar offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Domínios que NUNCA devem ser interceptados pelo SW
// (APIs dinâmicas, Firebase, Google Apps Script)
const BYPASS_DOMAINS = [
  'script.google.com',       // Google Apps Script (planilha)
  'firestore.googleapis.com',// Firebase Firestore
  'firebase.googleapis.com', // Firebase Auth/outros
  'www.gstatic.com',         // Firebase SDK (imports dinâmicos)
  'identitytoolkit.googleapis.com'
];

// Instalação: salva apenas os assets locais do app
self.addEventListener('install', event => {
  // skipWaiting imediato: nova versão assume controle sem precisar do banner
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
      });
    })
  );
});

// Ativação: limpa caches antigos e assume controle de todas as abas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Removendo cache antigo:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — estratégia por tipo de recurso:
// 1. APIs dinâmicas (Firebase, Apps Script) → sempre rede, nunca intercepta
// 2. index.html                             → Network First (sempre atualizado)
// 3. Assets estáticos (fontes, libs, imgs)  → Cache First (rápido offline)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Deixa passar direto — não intercepta APIs dinâmicas
  if (BYPASS_DOMAINS.some(d => url.hostname.includes(d))) {
    return; // SW não interfere — vai direto para a rede
  }

  // 2. index.html → Network First
  const isIndex = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isIndex) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2.1 Outras páginas HTML do site (ex: cotton.html) → Network First isolado.
  //     IMPORTANTE: o fallback de erro busca a própria página no cache,
  //     nunca cai para './index.html' — isso evita que, numa falha de rede
  //     pontual, o app errado seja exibido no lugar (bug corrigido aqui).
  const isOutraPaginaHtml = url.pathname.endsWith('.html') && !isIndex;
  if (isOutraPaginaHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Assets estáticos (não-HTML) → Cache First, atualiza cache em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // rede falhou: usa cache se houver, senão propaga o erro
      // Serve do cache imediatamente E atualiza em background
      return cached || networkFetch;
    })
  );
});

// Recebe mensagem do app
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


// ── Push do FCM ────────────────────────────────────────────
// IMPORTANTE: o tratamento de push FCM é feito INTEIRAMENTE pelo
// firebase-messaging-sw.js (via messaging.onBackgroundMessage).
// Antes havia um listener 'push' genérico aqui também — isso fazia
// o mesmo push ser tratado duas vezes (uma por cada Service Worker),
// causando notificação duplicada na web. Removido de propósito.
// Isso NÃO afeta o Android: o app nativo (Capacitor) nunca usa
// nenhum dos dois Service Workers para receber notificações.
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se o app já está aberto em alguma aba, foca ela
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão abre uma nova aba
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Fecha notificação ao deslizar (dispensar) ────────────────
self.addEventListener('notificationclose', () => {
  // Espaço para analytics futuro se precisar
});
