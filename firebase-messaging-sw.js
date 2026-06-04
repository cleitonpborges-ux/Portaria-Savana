/* ============================================================
   FIREBASE MESSAGING SERVICE WORKER — PORTARIA SAVANA
   Nome OBRIGATÓRIO: firebase-messaging-sw.js na RAIZ do site
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

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
// CORREÇÕES Samsung One UI / Motorola My UX:
//
// PROBLEMA 1 — "Não é flutuante (heads-up)":
//   requireInteraction era só para chamadas. Agora é true para TODOS.
//   Samsung One UI e Motorola My UX suprimem notificações que podem
//   "sumir sozinhas" como pop-up; com requireInteraction: true o sistema
//   trata como alta prioridade e exibe o heads-up.
//
// PROBLEMA 2 — "Não aparece com celular bloqueado":
//   O close() antes do showNotification força o sistema a reprocessar
//   a notificação como NOVA, o que garante que ela apareça na tela
//   bloqueada mesmo no One UI (que às vezes agrupa silenciosamente).
//
// PROBLEMA 3 — "Não notifica com app fechado":
//   O onBackgroundMessage do SDK compat já lida com isso, mas o
//   waitUntil estava faltando — o SW podia morrer antes de exibir.
//   Agora retornamos a Promise para o SDK encadear corretamente.
messaging.onBackgroundMessage((payload) => {
  const tipo  = payload.data?.tipo  || "chamada";
  const placa = payload.data?.placa || "";

  const titulo = payload.notification?.title
    || (tipo === "entrada" ? `🚛 NOVA ENTRADA — ${placa}` : `📢 CHAMADA — ${placa}`);
  const corpo  = payload.notification?.body || "";

  const ehChamada = tipo === "chamada";
  const tag = `${tipo}-${placa}`;

  // Fecha notificação anterior com mesma tag ANTES de mostrar a nova.
  // Isso força heads-up no Samsung One UI e Motorola My UX, que às vezes
  // agrupam silenciosamente quando recebem renotify sem o close() prévio.
  return self.registration.getNotifications({ tag })
    .then(antigas => { antigas.forEach(n => n.close()); })
    .then(() => self.registration.showNotification(titulo, {
      body:    corpo,
      icon:    "/icons/icon-192.png",
      badge:   "/icons/ic_notification_xxhdpi.png",
      tag,
      renotify: true,

      // true para TODOS os tipos (era só ehChamada antes).
      // Garante notificação na tela bloqueada e heads-up de alta prioridade.
      requireInteraction: true,

      // Vibração mais longa = maior chance de heads-up no One UI
      vibrate: ehChamada ? [300, 150, 300, 150, 600] : [150, 75, 150],
      silent:  false,

      // Sem actions — toque na notificação abre o app diretamente
      data: { placa, tipo, url: self.location.origin + "/" }
    }));
});

// ── Clique na notificação: abre / foca o app ─────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.location.origin + "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus().then(c => {
            // Avisa o app qual placa foi clicada (para destacar o card)
            const { placa, tipo: tipoNotif } = event.notification.data || {};
            if (placa) c.postMessage({ tipo: "notificacao_clicada", placa, tipoNotif });
          });
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
