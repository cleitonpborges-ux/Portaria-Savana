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

    const titulo  = data.titulo  || "Portaria Savana";
    const corpo   = data.corpo   || "";
    const placa   = data.placa   || "";
    const tipo    = data.tipo    || "chamada";
    const produto = (data.produto || "").toUpperCase();

    const ehChamada = tipo === "chamada";

    const mensagemBase = {
      notification: {
        title: titulo,
        body:  corpo,
      },
      android: {
        priority: "high",
        notification: {
          // IMPORTANTE: este canal precisa ser criado pelo app (FirebaseMessaging.createChannel
          // no Capacitor) antes da 1ª notificação. Se o canal não existir no dispositivo,
          // o Android 8+ descarta a notificação em background SEM erro nenhum.
          channelId:             "high_importance_channel",
          color:                 "#0f2040",
          sound:                 "default",
          vibrateTimingsMillis:  ehChamada ? [0, 300, 150, 300, 150, 600] : [0, 150, 75, 150],
          defaultVibrateTimings: false,
          tag:                   `${tipo}-${placa}`,
          sticky:                true,
          notificationPriority:  "PRIORITY_HIGH",
          visibility:            "PUBLIC",
          // Sem actions — toque na notificação abre o app diretamente
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
          requireInteraction: true,
          vibrate:            ehChamada ? [300, 150, 300, 150, 600] : [150, 75, 150],
          silent:             false,
          // Sem actions — toque na notificação abre o app diretamente
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
        // Quem recebe é decidido pela permissão marcada no perfil de cada
        // usuário (notif_entradas / notif_chamada, configurável em "Gerenciar
        // Perfis"), não por uma lista fixa de nomes de login. Assim, qualquer
        // perfil novo (ex: um segundo porteiro) entra só marcando a permissão
        // dele — sem precisar editar esta função de novo.
        // "perfis" (lista de nomes) ainda é aceito como override manual, caso
        // algum caller queira mirar perfis específicos pelo nome de login.
        const campoFiltro = ehChamada ? "notifChamada" : "notifEntrada";

        const tokensSnap = data.perfis
          ? await db.collection("fcm_tokens").where("perfil", "in", data.perfis).get()
          : await db.collection("fcm_tokens").where(campoFiltro, "==", true).get();

        if (tokensSnap.empty) {
          console.warn(`[FCM] Nenhum token encontrado para ${campoFiltro}=true`);
        } else {
          // Para "entrada": respeita o filtro de produto de cada perfil
          // (mesmo critério usado na notificação local em primeiro plano —
          // produtoFiltro vazio/nulo = recebe de todos os produtos).
          const tokens = tokensSnap.docs
            .map(d => d.data())
            .filter(t => {
              if (!t.token) return false;
              if (ehChamada) return true; // chamada não tem conceito de produto
              const filtro = (t.produtoFiltro || "").toUpperCase();
              return !filtro || produto.includes(filtro);
            })
            .map(t => t.token);

          if (tokens.length === 0) {
            console.warn(`[FCM] ${tokensSnap.size} token(s) tinham ${campoFiltro}=true, mas nenhum passou no filtro de produto "${produto}"`);
          }
          console.log(`[FCM] Enviando para ${tokens.length} token(s) — filtro: ${campoFiltro}${!ehChamada ? ` / produto: ${produto || '(nenhum)'}` : ''}`);

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
                console.warn(`[FCM] Falha token ...${lote[idx].slice(-8)}: ${codigo}`);
                // Não deletamos tokens automaticamente — tokens Android podem ser
                // rejeitados temporariamente após reinstalação do APK.
                // O token é atualizado automaticamente quando o usuário abre o app.
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
