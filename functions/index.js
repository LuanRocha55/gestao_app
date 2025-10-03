// CORREÇÃO: Substitui o código de exemplo pelas funções necessárias.
const functions = require("firebase-functions");
const axios = require("axios");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

// Função para iniciar a geração do vídeo
exports.generateHeyGenVideo = functions.https.onCall(async (data, context) => {
  // 1. Autenticação: Garante que o usuário esteja logado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar logado para gerar vídeos."
    );
  }

  const { serviceId, text, avatarId } = data;
  if (!serviceId || !text || !avatarId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Dados insuficientes para gerar o vídeo."
    );
  }

  // 2. Segurança: Pega a API Key das secrets do Firebase
  const HEYGEN_API_KEY = functions.config().heygen.key;
  if (!HEYGEN_API_KEY) {
    throw new functions.https.HttpsError(
      "internal",
      "A API Key do HeyGen não está configurada no servidor."
    );
  }

  // MUDANÇA: Defina a Voice ID aqui.
  // Você pode encontrar a lista de vozes disponíveis na documentação da API HeyGen ou no seu painel.
  // Exemplo de Voice ID: "8b93b539c1c643a3a1d3345ef3365a6a"
  const HEYGEN_VOICE_ID = "sua-voice-id-preferida"; // <-- SUBSTITUA ISTO

  // 3. Chamada à API do HeyGen
  try {
    const response = await axios.post(
      "https://api.heygen.com/v1/video/generate",
      {
        background: { type: "color", value: "#FFFFFF" },
        clips: [
          {
            avatar_id: avatarId,
            avatar_style: "normal",
            input_text: text,
            voice_id: HEYGEN_VOICE_ID, // Usa a constante
          },
        ],
        test: false,
        // Passa o ID do serviço para receber de volta no webhook
        callback_id: serviceId,
      },
      { headers: { "X-Api-Key": HEYGEN_API_KEY } }
    );

    // 4. Atualiza o Firestore com o status "processando"
    const db = getFirestore();
    await db.collection("services").doc(serviceId).update({
      videoStatus: "processing",
      videoId: response.data.data.video_id,
    });

    return { success: true, message: "Geração de vídeo iniciada." };
  } catch (error) {
    console.error("Erro na API HeyGen:", error.response?.data || error.message);
    throw new functions.https.HttpsError(
      "internal",
      "Falha ao iniciar a geração do vídeo."
    );
  }
});

// Webhook para receber a notificação de vídeo pronto
exports.heyGenWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === "POST") {
    const { event, data } = req.body;
    if (event === "video.success" && data?.video_id) {
      const serviceId = data.callback_id;
      if (serviceId) {
        const db = getFirestore();
        await db.collection("services").doc(serviceId).update({
          videoStatus: "completed",
          videoUrl: data.video_url,
        });
      }
    }
    res.status(200).send("Webhook recebido.");
  } else {
    res.status(405).send("Método não permitido.");
  }
});
