// CORREÇÃO: Substitui o código de exemplo pelas funções necessárias.
const functions = require("firebase-functions");
const axios = require("axios");
const { getFirestore } = require("firebase-admin/firestore");
const { google } = require("googleapis");
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
            // MUDANÇA: Use um ID de voz válido diretamente ou de uma variável.
            voice_id: "8b93b539c1c643a3a1d3345ef3365a6a", // ID de voz de exemplo.
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

// MUDANÇA: Nova função para criar um Google Doc para um serviço
exports.createGoogleDocForService = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado."
      );
    }

    const { serviceId, serviceName } = data;
    if (!serviceId || !serviceName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID ou nome do serviço ausente."
      );
    }

    // Log para depuração
    functions.logger.info("Iniciando criação de Google Doc para o serviço:", {
      serviceId,
      user: context.auth.token.email,
    });
    try {
      // Autentica usando as credenciais padrão do ambiente do Firebase
      const auth = new google.auth.GoogleAuth({
        scopes: [
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/drive.file", // MUDANÇA: Adiciona escopo do Drive para permissões
        ],
      });
      const authClient = await auth.getClient();
      const docs = google.docs({ version: "v1", auth: authClient });
      // MUDANÇA: Inicializa a API do Drive
      const drive = google.drive({ version: "v3", auth: authClient });

      // Cria o documento
      const createResponse = await docs.documents.create({
        requestBody: {
          title: serviceName,
        },
      });

      const docId = createResponse.data.documentId;
      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
      functions.logger.info(`Documento ${docId} criado com sucesso.`);

      // MUDANÇA: Compartilha o documento com o usuário que fez a solicitação
      const userEmail = context.auth.token.email;
      if (userEmail) {
        functions.logger.info(`Compartilhando com ${userEmail}...`);
        await drive.permissions.create({
          fileId: docId,
          requestBody: {
            role: "writer", // Dá permissão de edição
            type: "user",
            emailAddress: userEmail,
          },
        });
        functions.logger.info("Documento compartilhado.");
      }

      // Salva o ID do documento no Firestore
      const db = getFirestore();
      await db.collection("services").doc(serviceId).update({ googleDocId: docId });
      functions.logger.info("Firestore atualizado.");

      return { success: true, documentUrl: docUrl };
    } catch (error) {
      // MUDANÇA: Log de erro mais detalhado no Firebase
      functions.logger.error("Erro ao criar Google Doc:", {
        serviceId,
        errorMessage: error.message,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Falha ao criar o documento no Google Docs. Verifique os logs da função para mais detalhes."
      );
    }
  }
);
