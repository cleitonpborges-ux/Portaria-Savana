/* ============================================================
   FIREBASE MESSAGING SERVICE WORKER — PORTARIA SAVANA
   Nome OBRIGATÓRIO: firebase-messaging-sw.js na RAIZ do site
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCkD415LbF4S97BqRNXHBxnuGUDwzcUAd4",
  authDomain:        "portaria-savana.firebaseapp.com",
  projectId:         "portaria-savana",
  storageBucket:     "portaria-savana.firebasestorage.app",
  messagingSenderId: "983062289504",
  appId:             "1:983062289504:web:38ececbd6ec52fafc4f705"
});

const messaging = firebase.messaging();

// ── Notificação em BACKGROUND / app fechado ──────────────────
messaging.onBackgroundMessage((payload) => {
  const tipo  = payload.data?.tipo  || "chamada";
  const placa = payload.data?.placa || "";

  const titulo = payload.notification?.title
    || (tipo === "entrada" ? `🚛 NOVA ENTRADA — ${placa}` : `📢 CHAMADA — ${placa}`);
  const corpo  = payload.notification?.body || "";

  const ehChamada = tipo === "chamada";

  self.registration.showNotification(titulo, {
    body:               corpo,
    icon:               "/icons/icon-192.png",
    badge:              "/icons/ic_notification.png",
    tag:                `${tipo}-${placa}`,
    renotify:           true,
    vibrate:            ehChamada ? [200, 100, 200, 100, 400] : [100, 50, 100],
    requireInteraction: ehChamada,
    silent:             false,
    data:               { placa, tipo, url: self.location.origin + "/" }
  });
});

// ── Clique na notificação: abre / foca o app ─────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin + "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Recebe SKIP_WAITING da página ────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
