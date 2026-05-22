const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");
const { getFirestore }      = require("firebase-admin/firestore");

initializeApp();

exports.enviarPushNotificacao = onDocumentCreated(
  "push_queue/{docId}",
  async (event) => {
    const db   = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.enviado) return;

    const titulo = data.titulo || "Portaria Savana";
    const corpo  = data.corpo  || "";
    const placa  = data.placa  || "";
    const tipo   = data.tipo   || "chamada";

    const mensagemBase = {
      notification: {
        title: titulo,
        body:  corpo,
      },
      android: {
        priority: "high",
        notification: {
          channelId:            "portaria_chamadas",
          // icon removido — Android usa o ícone do app automaticamente
          color:                "#0f2040",
          sound:                "default",
          vibrateTimingsMillis: [0, 200, 100, 200, 100, 400],
          defaultVibrateTimings: false,
          tag:                  `${tipo}-${placa}`,
          sticky:               tipo === "chamada",
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title:              titulo,
          body:               corpo,
          icon:               "/icons/icon-192.png",
          badge:              "/icons/ic_notification_xxhdpi.png",
          tag:                `${tipo}-${placa}`,
          renotify:           true,
          requireInteraction: tipo === "chamada",
          vibrate:            [200, 100, 200, 100, 400],
          data:               { placa, tipo, url: "/" },
        },
        fcmOptions: { link: "/" },
      },
      data: { placa, tipo },
    };

    try {
      if (data.token) {
        await getMessaging().send({ ...mensagemBase, token: data.token });
        console.log(`[FCM] Push enviado para token ${data.token.slice(-8)} — ${titulo}`);
      } else {
        const perfisAlvo = data.perfis || (tipo === "chamada" ? ["porteiro", "admin"] : ["admin", "balanca"]);

        const tokensSnap = await db
          .collection("fcm_tokens")
          .where("perfil", "in", perfisAlvo)
          .get();

        if (tokensSnap.empty) {
          console.warn("[FCM] Nenhum token encontrado para perfis:", perfisAlvo);
        } else {
          const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
          console.log(`[FCM] Enviando para ${tokens.length} token(s) — perfis: ${perfisAlvo.join(", ")}`);

          const LOTE = 500;
          for (let i = 0; i < tokens.length; i += LOTE) {
            const lote = tokens.slice(i, i + LOTE);
            const resp = await getMessaging().sendEachForMulticast({
              ...mensagemBase,
              tokens: lote,
            });

            resp.responses.forEach((r, idx) => {
              if (!r.success) {
                const codigo = r.error?.code || "";
                if (
                  codigo === "messaging/invalid-registration-token" ||
                  codigo === "messaging/registration-token-not-registered"
                ) {
                  const tokenInvalido = lote[idx];
                  db.collection("fcm_tokens").doc(tokenInvalido).delete()
                    .then(() => console.log(`[FCM] Token inválido removido: ${tokenInvalido.slice(-8)}`))
                    .catch(() => {});
                }
              }
            });

            console.log(`[FCM] Lote ${i / LOTE + 1}: ${resp.successCount} ok, ${resp.failureCount} erro(s)`);
          }
        }
      }

      await snap.ref.update({ enviado: true, enviadoEm: new Date() });

    } catch (err) {
      console.error("[FCM] Erro ao enviar push:", err);
    }
  }
);
