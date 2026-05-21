/* ============================================================
   FIREBASE MESSAGING SERVICE WORKER
   Nome OBRIGATÓRIO: firebase-messaging-sw.js
   Deve ficar na RAIZ do servidor (mesmo nível do index.html)
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

// Mesma config do index.html
firebase.initializeApp({
  apiKey:            "AIzaSyCkD415LbF4S97BqRNXHBxnuGUDwzcUAd4",
  authDomain:        "portaria-savana.firebaseapp.com",
  projectId:         "portaria-savana",
  storageBucket:     "portaria-savana.firebasestorage.app",
  messagingSenderId: "983062289504",
  appId:             "1:983062289504:web:38ececbd6ec52fafc4f705"
});

const messaging = firebase.messaging();

// ── Notificação em BACKGROUND (app fechado ou minimizado) ────
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Mensagem em background recebida:', payload);

  const placa     = payload.data?.placa || '';
  const titulo    = payload.notification?.title  || `🚛 CHAMADA — ${placa}`;
  const corpo     = payload.notification?.body   || 'Nova chamada ativa na portaria';
  const icone     = payload.notification?.icon   || 'icons/icon-192.png';

  self.registration.showNotification(titulo, {
    body:               corpo,
    icon:               icone,
    badge:              'icons/icon-32.png',
    tag:                `chamada-${placa}`,
    renotify:           true,
    vibrate:            [200, 100, 200, 100, 400],  // curto-curto-longo
    requireInteraction: true,                        // fica na tela até tocar
    data:               { placa, url: self.location.origin + '/' }
  });
});

// ── Clique na notificação: abre/foca o app ───────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
