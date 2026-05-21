const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");
const { getFirestore }      = require("firebase-admin/firestore");

initializeApp();

/**
 * Cloud Function: enviarPushNotificacao
 *
 * Dispara quando qualquer documento é criado em /push_queue/{docId}
 * Documento esperado:
 *   {
 *     titulo:  string,
 *     corpo:   string,
 *     placa:   string,
 *     token:   string  (se definido → envia só pra esse device)
 *              OU
 *     perfis:  string[] (ex: ['porteiro','admin'] → envia pra todos esses perfis)
 *     ts:      Timestamp,
 *     enviado: boolean
 *   }
 */
exports.enviarPushNotificacao = onDocumentCreated(
  "push_queue/{docId}",
  async (event) => {
    const db   = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (data.enviado) return; // segurança contra reprocessamento

    const titulo = data.titulo || "Portaria Savana";
    const corpo  = data.corpo  || "";
    const placa  = data.placa  || "";
    const tipo   = data.tipo   || "chamada"; // 'chamada' | 'entrada'

    // ── Monta a mensagem FCM base ────────────────────────────────────────
    const mensagemBase = {
      notification: {
        title: titulo,
        body:  corpo,
      },
      android: {
        priority: "high",
        notification: {
          channelId:   "portaria_chamadas",
          icon:        "ic_notification",   // drawable no app nativo (PWA usa o badge)
          color:       "#0f2040",
          sound:       "default",
          vibrateTimingsMillis: [0, 200, 100, 200, 100, 400],
          defaultVibrateTimings: false,
          tag:         `${tipo}-${placa}`,  // agrupa por placa — não acumula spam
          sticky:      tipo === "chamada",  // chamada fica até tocar; entrada some sozinha
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title:              titulo,
          body:               corpo,
          icon:               "/icons/icon-192.png",
          badge:              "/icons/icon-32.png",
          tag:                `${tipo}-${placa}`,
          renotify:           true,
          requireInteraction: tipo === "chamada", // só chamada fica presa na tela
          vibrate:            [200, 100, 200, 100, 400],
          data:               { placa, tipo, url: "/" },
        },
        fcmOptions: { link: "/" },
      },
      data: { placa, tipo },
    };

    try {
      // ── MODO 1: token individual definido ───────────────────────────────
      if (data.token) {
        await getMessaging().send({ ...mensagemBase, token: data.token });
        console.log(`[FCM] Push enviado para token ${data.token.slice(-8)} — ${titulo}`);

      // ── MODO 2: envia para perfis específicos ───────────────────────────
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

          // Envia em lotes de 500 (limite FCM)
          const LOTE = 500;
          for (let i = 0; i < tokens.length; i += LOTE) {
            const lote = tokens.slice(i, i + LOTE);
            const resp = await getMessaging().sendEachForMulticast({
              ...mensagemBase,
              tokens: lote,
            });

            // Remove tokens inválidos do Firestore automaticamente
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

      // Marca como enviado para não reprocessar
      await snap.ref.update({ enviado: true, enviadoEm: new Date() });

    } catch (err) {
      console.error("[FCM] Erro ao enviar push:", err);
    }
  }
);
