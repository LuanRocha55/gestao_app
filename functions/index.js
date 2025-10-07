// CORREÇÃO: Substitui o código de exemplo pelas funções necessárias.
const functions = require("firebase-functions");
const axios = require("axios"); // MUDANÇA: Adiciona o admin do Firebase
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

// MUDANÇA: Nova função agendada para verificar serviços atrasados.
// Esta função será executada todos os dias às 9:00 da manhã.
exports.checkOverdueServices = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("America/Sao_Paulo") // Define o fuso horário
  .onRun(async (context) => {
    const db = getFirestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

    // 1. Busca todos os serviços que ainda não foram notificados como atrasados.
    const servicesRef = db.collection("services");
    const snapshot = await servicesRef
      .where("overdueNotified", "!=", true)
      .get();

    if (snapshot.empty) {
      console.log("Nenhum serviço para verificar.");
      return null;
    }

    const batch = db.batch();
    const emailsToSend = [];

    // 2. Itera sobre os serviços e filtra os que estão realmente atrasados.
    for (const doc of snapshot.docs) {
      const service = doc.data();
      const serviceId = doc.id;

      // Pula se não tiver data de entrega ou responsável
      if (!service.dueDate || !service.responsible) {
        continue;
      }

      const dueDate = new Date(service.dueDate);
      const isOverdue = dueDate < today;

      // Calcula o progresso para não notificar serviços já concluídos
      const allSubtasks = (service.steps || []).flatMap((s) => s.subtasks || []);
      const completedSubtasks = allSubtasks.filter((st) => st.completed).length;
      const progress =
        allSubtasks.length > 0
          ? (completedSubtasks / allSubtasks.length) * 100
          : 0;

      if (isOverdue && progress < 100) {
        // 3. O serviço está atrasado. Prepara a notificação.
        console.log(`Serviço "${service.name}" (${serviceId}) está atrasado.`);

        // Marca o serviço para ser atualizado, evitando novas notificações
        batch.update(doc.ref, { overdueNotified: true });

        // Adiciona o e-mail à fila de envio
        emailsToSend.push({
          serviceName: service.name,
          serviceId: serviceId,
          responsibleId: service.responsible,
        });
      }
    }

    // 4. Busca os e-mails dos usuários responsáveis
    if (emailsToSend.length > 0) {
      for (const item of emailsToSend) {
        const userDoc = await db.collection("users").doc(item.responsibleId).get();
        if (userDoc.exists() && userDoc.data().email) {
          const userData = userDoc.data();
          // 5. Adiciona um documento na coleção 'mail' para disparar o e-mail
          const mailRef = db.collection("mail").doc();
          batch.set(mailRef, {
            to: userData.email,
            message: {
              subject: `[ALERTA] O serviço "${item.serviceName}" está atrasado!`,
              html: `
                <h1>Alerta de Prazo Expirado</h1>
                <p>Olá, ${userData.displayName || "usuário"}!</p>
                <p>O serviço <strong>"${
                  item.serviceName
                }"</strong>, que está sob sua responsabilidade, ultrapassou a data de entrega e ainda não foi concluído.</p>
                <p>Por favor, acesse o painel para atualizar o status.</p>
                <a href="https://uniateneu-nead-gestao.web.app/#/service/${
                  item.serviceId
                }">Ver Serviço</a>
              `, // Você pode usar uma função para criar um HTML mais bonito aqui
            },
          });
        }
      }
    }

    // 6. Executa todas as atualizações e envios de e-mail em um único lote
    await batch.commit();
    console.log(
      `Verificação concluída. ${emailsToSend.length} notificações de atraso enviadas.`
    );
    return null;
  });
