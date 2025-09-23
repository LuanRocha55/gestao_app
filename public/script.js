// --- MUDANÇA: Importa tudo relacionado ao Firebase do novo módulo ---
import {
  db,
  auth,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  query,
  where,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
} from "./firebase.js";

const servicesCollection = collection(db, "services"); // Referência para a coleção 'services'
const usersCollection = collection(db, "users"); // Referência para a coleção de usuários
const requestsCollection = collection(db, "requests"); // Referência para a coleção de solicitações

document.addEventListener("DOMContentLoaded", () => {
  // --- MUDANÇA: Variáveis de estado e elementos da UI ---
  let currentUser = null;
  let services = [];
  let teamMembers = [];
  let teamMemberMap = new Map();
  let currentEditServiceId = null; // MUDANÇA: Para rastrear o serviço em edição
  let sortableSteps = null; // MUDANÇA: Para a instância do SortableJS
  let unsubscribeFromComments = null; // MUDANÇA: Listener para comentários
  let unsubscribeFromRequests = null; // MUDANÇA: Listener para solicitações
  let unsubscribeFromServices = null; // Para parar de ouvir os dados ao fazer logout

  // --- MUDANÇA: Elementos de Autenticação expandidos ---
  const loginContainer = document.getElementById("login-container"); // Container principal
  const loginBox = document.getElementById("login-box");
  const registerBox = document.getElementById("register-box");
  const emailLoginForm = document.getElementById("email-login-form");
  const googleLoginBtn = document.getElementById("google-login-btn");
  const registerForm = document.getElementById("register-form");
  const toggleToRegister = document.getElementById("toggle-to-register");
  const toggleToLogin = document.getElementById("toggle-to-login");
  const loginErrorEl = document.getElementById("login-error");
  const registerErrorEl = document.getElementById("register-error");
  const logoutBtn = document.getElementById("logout-btn");
  const appHeader = document.getElementById("app-header");
  const userProfile = document.getElementById("user-profile");
  const userNameEl = document.getElementById("user-name");
  const userPhotoEl = document.getElementById("user-photo");
  const requestsLink = document.getElementById("requests-link");
  const serviceContainer = document.getElementById("service-container");
  const themeToggle = document.getElementById("theme-toggle");
  const addServiceBtn = document.getElementById("add-service-btn");
  const modal = document.getElementById("add-service-modal");
  const makeRequestBtn = document.getElementById("make-request-btn");
  const addServiceForm = document.getElementById("add-service-form");
  const searchInput = document.getElementById("search-input");
  const taskDetailView = document.getElementById("task-detail-view");
  const profileView = document.getElementById("profile-view");
  const requestsView = document.getElementById("requests-view");
  const addStepBtn = document.getElementById("add-step-btn");
  const stepsContainer = document.getElementById("steps-container");
  const makeRequestModal = document.getElementById("make-request-modal");
  const makeRequestForm = document.getElementById("make-request-form");
  const loadingOverlay = document.getElementById("loading-overlay");
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const headerMenuItems = document.getElementById("header-menu-items");

  // --- MUDANÇA: Lógica para o seletor de tema ---
  // Verifica o tema salvo no localStorage ao carregar a página
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    themeToggle.checked = true;
  }

  // Adiciona o evento de clique para o seletor de tema
  themeToggle.addEventListener("change", () => {
    if (themeToggle.checked) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark"); // Salva a preferência
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light"); // Salva a preferência
    }
  });

  // --- Funções Utilitárias ---
  const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  function isValidEmail(email) {
    return email && emailRegex.test(String(email).toLowerCase());
  }

  // MUDANÇA: Funções para controlar o indicador de carregamento
  function showLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove("hidden");
    }
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.add("hidden");
    }
  }

  // --- MUDANÇA: Listener de serviços agora filtra por usuário ---
  function listenForServices(user) {
    // Se já houver um listener ativo, cancela-o antes de criar um novo.
    if (unsubscribeFromServices) {
      unsubscribeFromServices();
    }

    // --- MUDANÇA: Query agora busca serviços onde o usuário é membro ---
    const allServicesQuery = query(
      servicesCollection,
      orderBy("createdAt", "desc")
    );

    unsubscribeFromServices = onSnapshot(
      allServicesQuery,
      async (querySnapshot) => {
        // MUDANÇA: Lógica aprimorada para lidar com dados de exemplo
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const hasSeenExamples = userDocSnap.data()?.hasSeenExamples || false;

        if (querySnapshot.empty && !hasSeenExamples) {
          console.log(
            "Nenhum serviço encontrado. Adicionando dados de exemplo..."
          );
          await addExampleData(user); // Adiciona os dados
          await setDoc(userDocRef, { hasSeenExamples: true }, { merge: true }); // Marca que o usuário já viu os exemplos
          // A função onSnapshot será chamada novamente com os novos dados, então não precisamos fazer mais nada aqui.
          return; // Sai para aguardar a próxima atualização
        }

        services = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Se a visualização de detalhes estiver ativa, atualize-a.
        // Caso contrário, renderize a lista principal.
        // MUDANÇA: Simplificado para sempre chamar o roteador.
        // Isso garante que a view correta (seja a lista ou os detalhes) seja sempre atualizada com os novos dados.
        handleRouteChange();
        console.log("Dados atualizados em tempo real!");
      }
    );
  }

  async function addExampleData(user) {
    const exampleServices = [
      {
        name: "Livro de Exemplo",
        responsible: user.uid,
        category: "Desenvolvimento",
        files: [],
        steps: [
          {
            name: "Conteudista",
            // MUDANÇA: Garante que a estrutura de sub-tarefas sempre exista
            subtasks: [
              { name: "Unidade 1", completed: true },
              { name: "Unidade 2", completed: true },
              { name: "Unidade 3", completed: true },
              { name: "Unidade 4", completed: true },
            ],
          },
          {
            name: "DI",
            subtasks: [
              { name: "Unidade 1", completed: true },
              { name: "Unidade 2", completed: false },
              { name: "Unidade 3", completed: false },
              { name: "Unidade 4", completed: false },
            ],
          },
          {
            name: "PDF",
            subtasks: [
              { name: "Unidade 1", completed: false },
              { name: "Unidade 2", completed: false },
              { name: "Unidade 3", completed: false },
              { name: "Unidade 4", completed: false },
            ],
          },
          {
            name: "AudioVisual",
            subtasks: [
              { name: "Unidade 1", completed: false },
              { name: "Unidade 2", completed: false },
              { name: "Unidade 3", completed: false },
              { name: "Unidade 4", completed: false },
            ],
          },
        ],
        ownerId: user.uid, // O criador original
      },
      {
        name: "Campanha de Exemplo",
        responsible: user.uid,
        category: "Marketing",
        files: [],
        steps: [
          {
            name: "Definir público-alvo",
            subtasks: [{ name: "Tarefa Única", completed: true }]
          },
          {
            name: "Criar criativos",
            subtasks: [{ name: "Tarefa Única", completed: true }]
          },
          {
            name: "Configurar anúncios",
            subtasks: [{ name: "Tarefa Única", completed: false }]
          },
          {
            name: "Analisar resultados",
            subtasks: [{ name: "Tarefa Única", completed: false }]
          },
        ],
        ownerId: user.uid,
      },
    ];

    const batch = writeBatch(db);
    exampleServices.forEach((service) => {
      const docRef = doc(servicesCollection); // Cria uma referência com ID automático
      batch.set(docRef, service);
    });
    await batch.commit();
  }

  // --- MUDANÇA: Funções para gerenciar a lista de usuários ---
  async function updateUserInFirestore(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userData = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    };
    // Usa set com merge:true para criar ou atualizar o usuário sem sobrescrever campos existentes (como 'role')
    await setDoc(userDocRef, userData, { merge: true });
  }

  async function loadTeamMembers() {
    const querySnapshot = await getDocs(usersCollection);
    teamMembers = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: data.uid, name: data.displayName || data.email };
    });
    teamMemberMap = new Map(teamMembers.map((m) => [m.id, m.name]));
  }

  // --- MUDANÇA: Funções para a página de solicitações ---
  function renderRequestsPage() {
    requestsView.innerHTML = `
            <div class="detail-header">
                <h2>Gerenciar Solicitações</h2>
                <a href="#" class="btn-secondary">Voltar para a lista</a>
            </div>
            <div id="requests-list-container"></div>
        `;

    listenForRequests();
  }

  function listenForRequests() {
    const listContainer = document.getElementById("requests-list-container");
    if (!listContainer) return;

    // MUDANÇA: Garante que não haja listeners duplicados
    if (unsubscribeFromRequests) {
      unsubscribeFromRequests();
    }

    const q = query(requestsCollection, orderBy("createdAt", "desc"));

    // MUDANÇA: Armazena a função de unsubscribe
    unsubscribeFromRequests = onSnapshot(q, (querySnapshot) => {
      if (querySnapshot.empty) {
        listContainer.innerHTML = "<p>Nenhuma solicitação encontrada.</p>";
        return;
      }

      const requestsByStatus = {
        pending: [],
        approved: [],
        rejected: [],
      };

      querySnapshot.forEach((doc) => {
        const request = { id: doc.id, ...doc.data() };
        requestsByStatus[request.status].push(request);
      });

      listContainer.innerHTML = ""; // Limpa antes de renderizar

      // Renderiza as pendentes primeiro
      ["pending", "approved", "rejected"].forEach((status) => {
        if (requestsByStatus[status].length > 0) {
          const statusTitle = document.createElement("h3");
          statusTitle.className = "category-title";
          statusTitle.textContent =
            {
              pending: "Pendentes",
              approved: "Aprovadas",
              rejected: "Rejeitadas",
            }[status] || "Outras";
          listContainer.appendChild(statusTitle);

          requestsByStatus[status].forEach((request) => {
            const card = document.createElement("div");
            card.className = "request-card";
            card.dataset.status = request.status;
            card.dataset.id = request.id;

            const date =
              request.createdAt?.toDate().toLocaleDateString("pt-BR") ||
              "Data indisponível";

            card.innerHTML = `
                            <h3>${request.title}</h3>
                            <div class="request-meta">
                                Solicitado por: <span>${
                                  request.requesterName
                                }</span> em ${date}
                            </div>
                            <p class="request-description">${
                              request.description
                            }</p>
                            ${
                              request.status === "pending"
                                ? `<div class="request-actions">
                                    <button class="btn-primary btn-approve">Aprovar</button>
                                    <button class="btn-primary btn-reject">Rejeitar</button>
                                  </div>`
                                : ""
                            }`;
            listContainer.appendChild(card);
          });
        }
      });
    });
  }
  // --- MUDANÇA: Função para calcular progresso com base nas sub-tarefas ---
  function calculateOverallProgress(service) {
    const allSubtasks = service.steps.flatMap((s) => s.subtasks || []);
    if (allSubtasks.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    const completedSubtasks = allSubtasks.filter((st) => st.completed).length;
    const totalSubtasks = allSubtasks.length;
    return {
      completed: completedSubtasks,
      total: totalSubtasks,
      percentage: (completedSubtasks / totalSubtasks) * 100,
    };
  }

  // --- Função para Renderizar os Cartões de Serviço ---
  function renderServices() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const servicesToRender = services.filter((service) => {
      if (!searchTerm) return true; // Se a busca estiver vazia, mostra tudo

      const inName = service.name.toLowerCase().includes(searchTerm);
      const inResponsible = (teamMemberMap.get(service.responsible) || "")
        .toLowerCase()
        .includes(searchTerm);
      const inCategory = (service.category || "")
        .toLowerCase()
        .includes(searchTerm);
      const inSteps = service.steps.some((step) =>
        step.name.toLowerCase().includes(searchTerm)
      );

      return inName || inResponsible || inCategory || inSteps;
    });

    serviceContainer.innerHTML = ""; // Limpa o container antes de renderizar

    if (servicesToRender.length === 0 && searchTerm) {
      serviceContainer.innerHTML = `<p class="no-results">Nenhum serviço encontrado para "${searchInput.value}".</p>`;
      return;
    }
    // 1. Agrupar serviços por categoria
    const groupedServices = servicesToRender.reduce((acc, service) => {
      const category = service.category || "Outros"; // Agrupa em 'Outros' se não tiver categoria
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    }, {});

    // MUDANÇA: Usa um DocumentFragment para melhorar a performance da renderização,
    // montando todos os elementos em memória antes de adicioná-los ao DOM de uma só vez.
    const mainFragment = document.createDocumentFragment();

    // 2. Renderizar por grupo
    Object.keys(groupedServices)
      .sort()
      .forEach((category) => {
        // Cria e adiciona o título da categoria
        const titleEl = document.createElement("h3");
        titleEl.className = "category-title";
        titleEl.textContent = category;
        mainFragment.appendChild(titleEl);

        // Renderiza os cards dentro da categoria
        groupedServices[category].forEach((service) => {
          // MUDANÇA: O progresso agora é baseado nas sub-tarefas
          const progress = calculateOverallProgress(service);

          const responsibleName =
            teamMemberMap.get(service.responsible) || "Não atribuído";

          const card = document.createElement("div");
          card.className = "service-card";
          card.dataset.id = service.id;

          const stepsHtml = service.steps
            .map((step, index) => {
              const isStepCompleted =
                step.subtasks &&
                step.subtasks.length > 0 &&
                step.subtasks.every((st) => st.completed);

              return `<li class="step-item"> 
                        <input type="checkbox" id="step-${
                          service.id
                        }-${index}" data-step-index="${index}" ${
                isStepCompleted ? "checked" : ""
              }>
                        <label for="step-${service.id}-${index}">${step.name}</label>
                    </li>`;
            })
            .join("");

          card.innerHTML = `
                    <div class="card-header">
                        <h2><a href="#/task/${service.id}">${
            service.name
          }</a></h2>
                        <div class="card-actions">
                            <button class="btn-icon btn-edit" title="Editar Serviço" data-service-id="${
                              service.id
                            }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65,21.1,6,20.71,5.63L18.37,3.29C18,2.9,17.35,2.9,16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></button>
                            <button class="btn-icon btn-delete" title="Deletar Serviço" data-service-id="${
                              service.id
                            }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
                        </div>
                    </div>
                    <p class="responsible">Responsável: ${responsibleName}</p>
                    <div class="progress-info">
                        <span>Progresso</span>
                        <span class="progress-text">${Math.round(
                          progress.percentage
                        )}%</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${
                          progress.percentage
                        }%;"></div>
                    </div>
                    <ul class="steps-list">
                        ${stepsHtml}
                    </ul>
                `;
          mainFragment.appendChild(card);
        });
      });

    serviceContainer.appendChild(mainFragment);
  }

  // --- Funções da Página de Detalhes ---
  function renderTaskDetail(service, openSteps = []) {
    const responsibleName =
      teamMemberMap.get(service.responsible) || "Não atribuído";
    const progress = calculateOverallProgress(service);

    // MUDANÇA: Renderização aninhada para etapas e sub-tarefas
    const stepsHtml = service.steps
      .map((step, stepIndex) => {
        const subtasksHtml = (step.subtasks || [])
          .map(
            (subtask, subtaskIndex) => `
                <li class="step-item">
                    <input type="checkbox" id="subtask-${
                      service.id
                    }-${stepIndex}-${subtaskIndex}" data-step-index="${stepIndex}" data-subtask-index="${subtaskIndex}" ${
              subtask.completed ? "checked" : ""
            }>
                    <label for="subtask-${
                      service.id
                    }-${stepIndex}-${subtaskIndex}">${subtask.name}</label>
                </li>
            `
          )
          .join("");

        // MUDANÇA: Verifica se a etapa deve começar recolhida ou não
        const startCollapsed = !openSteps.includes(stepIndex);

        return `
                <li class="step-group" data-step-index="${stepIndex}">
                    <h4 class="step-group-title ${
                      startCollapsed ? "collapsed" : ""
                    }"><span class="step-name-toggle">${step.name}</span></h4>
                    <ul class="subtask-list ${
                      startCollapsed ? "hidden" : ""
                    }">${subtasksHtml}</ul>
                </li>`;
      })
      .join("");

    const filesHtml = (service.files || [])
      .map((file) => {
        // Se for um arquivo local, adiciona o atributo 'download'
        const downloadAttr = file.isLocal ? `download="${file.name}"` : "";
        return `
                <li class="file-item">
                    <a href="${file.url}" target="_blank" rel="noopener noreferrer" ${downloadAttr}>${file.name}</a>
                </li>
            `;
      })
      .join("");

    taskDetailView.innerHTML = `
            <div class="detail-header">
                <h2>${service.name}</h2>
                <a href="#" class="btn-secondary">Voltar para a lista</a>
            </div>
            <div class="detail-section">
                <h3>Informações Gerais</h3>
                <p><strong>Categoria:</strong> ${
                  service.category || "Não definida"
                }</p>
                <p><strong>Responsável Geral:</strong> ${responsibleName}</p>
            </div>
            <div class="detail-section">
                            <h3>Etapas e Sub-tarefas</h3>
                <ul class="steps-list-detailed">${stepsHtml}</ul>
            </div>
            <div class="detail-section">
                <h3>Arquivos</h3>
                <ul id="file-list" class="file-list">${filesHtml}</ul>
                <div class="file-upload-actions">
                    <form id="add-file-form">
                        <input type="text" id="file-url-input" placeholder="Cole a URL do arquivo aqui...">
                        <button type="submit" class="btn-primary">Adicionar Link</button>
                    </form>
                    <span class="upload-separator">ou</span>
                    <div class="upload-button-wrapper">
                        <label for="file-upload-input" class="btn-secondary">Carregar Arquivo</label>
                        <input type="file" id="file-upload-input" class="hidden">
                    </div>
                </div>
            </div>
            <div class="detail-section">
                <h3>Comentários</h3>
                <ul id="comments-list" class="comments-list">
                    <!-- Comentários serão carregados aqui -->
                </ul>
                <form id="comment-form">
                    <input type="text" id="comment-input" placeholder="Adicione um comentário..." required>
                    <button type="submit" class="btn-primary">Enviar</button>
                </form>
            </div>
        `;
  }

  // --- MUDANÇA: Função para renderizar a página de perfil ---
  function renderProfilePage() {
    // Avatares predefinidos (adicione os caminhos corretos se os tiver)
    const avatars = [
      "https://i.pinimg.com/736x/90/70/2e/90702e9f7ec5cdbe3ccfaf5a176b282c.jpg",
      "https://i.pinimg.com/736x/7e/c3/2f/7ec32f8508e5c34235ea9587d3174da4.jpg",
      "https://i.pinimg.com/736x/6b/32/f8/6b32f8607c7917fc2effb64ac8daee0e.jpg",
      "https://i.pinimg.com/736x/54/cc/5a/54cc5af315cb4128eeb92814d5e0becd.jpg",
      "https://i.pinimg.com/originals/d2/63/73/d26373c7582db185a7383a78de15509d.jpg",
      "https://pbs.twimg.com/media/ElhZ_U3W0CMKZ0D?format=jpg&name=large",
      "https://i.pinimg.com/474x/c9/15/02/c915026cc902d5149db900a739f216cf.jpg",
      "https://i.pinimg.com/736x/ba/49/c8/ba49c807037bd63f49ec4500262c7a41.jpg",
    ];

    const avatarsHtml = avatars
      .map(
        (src) =>
          `<img src="${src}" alt="Avatar" class="preset-avatar" data-url="${src}">`
      )
      .join("");

    profileView.innerHTML = `
            <div class="detail-header">
                <h2>Meu Perfil</h2>
                <a href="#" class="btn-secondary">Voltar para a lista</a>
            </div>
            <div class="detail-section">
                <h3>Informações da Conta</h3>
                <form id="profile-form">
                    <div class="form-group">
                        <label for="profile-name">Nome de Exibição</label>
                        <input type="text" id="profile-name" value="${
                          currentUser.displayName || ""
                        }" required>
                    </div>
                    <div class="form-group">
                        <label for="profile-email">Email</label>
                        <input type="email" id="profile-email" value="${
                          currentUser.email
                        }" disabled>
                    </div>
                    <p id="profile-success" class="auth-success hidden">Perfil atualizado com sucesso!</p>
                    <button type="submit" class="btn-primary">Salvar Alterações</button>
                </form>
            </div>
            <div class="detail-section">
                <h3>Foto de Perfil</h3>
                <div class="profile-picture-section">
                    <div class="profile-picture-wrapper" id="profile-picture-upload">
                        <img src="${
                          currentUser.photoURL || "./assets/default-avatar.png"
                        }" alt="Sua foto de perfil" id="profile-picture-preview">
                    </div>
                    <input type="file" id="profile-picture-input" class="hidden" accept="image/*">
                    <p>Clique na imagem para carregar uma nova ou escolha um avatar abaixo.</p>
                    <div class="preset-avatars-container">
                        ${avatarsHtml}
                    </div>
                </div>
            </div>
        `;
  }

  // MUDANÇA: Função para ouvir e renderizar comentários em tempo real
  function listenForComments(serviceId) {
    const commentsList = document.getElementById("comments-list");
    if (!commentsList) return;

    // Garante que não haja listeners duplicados
    if (unsubscribeFromComments) {
      unsubscribeFromComments();
    }

    const commentsQuery = query(
      collection(db, "services", serviceId, "comments"),
      orderBy("createdAt", "asc")
    );

    unsubscribeFromComments = onSnapshot(commentsQuery, (snapshot) => {
      if (snapshot.empty) {
        commentsList.innerHTML =
          "<p>Nenhum comentário ainda. Seja o primeiro a comentar!</p>";
        return;
      }

      commentsList.innerHTML = snapshot.docs
        .map((doc) => {
          const comment = doc.data();
          const timestamp =
            comment.createdAt?.toDate().toLocaleString("pt-BR") || "";

          return `
                    <li class="comment-item">
                        <div class="comment-avatar">
                            <img src="${
                              comment.authorPhotoURL ||
                              "./assets/default-avatar.png"
                            }" alt="Avatar de ${comment.authorName}">
                        </div>
                        <div class="comment-content">
                            <div class="comment-header">
                                <span class="comment-author">${
                                  comment.authorName
                                }</span>
                                <span class="comment-timestamp">${timestamp}</span>
                            </div>
                            <p class="comment-text">${comment.text}</p>
                        </div>
                    </li>
                `;
        })
        .join("");

      // Rola para o final da lista de comentários
      commentsList.scrollTop = commentsList.scrollHeight;
    });
  }
  // --- MUDANÇA: Roteador simples para gerenciar as visualizações ---
  function handleRouteChange() {
    if (!currentUser) return; // Não faz nada se o usuário não estiver logado

    const hash = window.location.hash;

    // Define qual view está ativa com base na URL
    const isTaskDetail = hash.startsWith("#/task/");
    const isProfile = hash.startsWith("#/profile");
    const isRequests = hash.startsWith("#/requests");
    const isMainView = !isTaskDetail && !isProfile && !isRequests;

    // MUDANÇA: Limpa o listener de comentários se não estiver na página de detalhes
    if (!isTaskDetail && unsubscribeFromComments) {
      unsubscribeFromComments();
      unsubscribeFromComments = null;
    }

    // Esconde/mostra os containers corretos
    serviceContainer.classList.toggle("hidden", !isMainView);
    taskDetailView.classList.toggle("hidden", !isTaskDetail);
    profileView.classList.toggle("hidden", !isProfile);
    requestsView.classList.toggle("hidden", !isRequests);

    // Adiciona uma classe ao body para estilizar o header de forma diferente
    document.body.classList.toggle("detail-view-active", !isMainView);

    // Carrega o conteúdo da view ativa
    if (isTaskDetail) {
      const taskId = hash.substring("#/task/".length);
      const service = services.find((s) => s.id === taskId);
      if (service) {
        // MUDANÇA: Preserva o estado de expansão das etapas ao recarregar
        const openStepsIndices = [];
        document
          .querySelectorAll("#task-detail-view .step-group-title:not(.collapsed)")
          .forEach((title) => {
            const stepGroup = title.closest(".step-group");
            if (stepGroup && stepGroup.dataset.stepIndex) {
              openStepsIndices.push(parseInt(stepGroup.dataset.stepIndex, 10));
            }
          });

        renderTaskDetail(service, openStepsIndices);
        listenForComments(taskId); // MUDANÇA: Começa a ouvir os comentários da tarefa
      } else {
        // Se a tarefa não for encontrada, volta para a lista principal
        console.warn(`Tarefa com ID ${taskId} não encontrada.`);
        window.location.hash = "";
      }
    } else if (isProfile) {
      renderProfilePage();
    } else if (isRequests) {
      renderRequestsPage();
    } else {
      // A view padrão é a lista de serviços
      renderServices();
    }
  }

  // --- MUDANÇA: Gerenciador de eventos centralizado (Event Delegation) ---
  // Ouve cliques em todo o documento para lidar com elementos criados dinamicamente
  document.addEventListener("click", async (e) => {
    // Botão "Voltar para a lista" nas páginas de detalhe/perfil
    if (e.target.matches(".detail-header .btn-secondary")) {
      e.preventDefault();
      window.location.hash = ""; // Navega para a página principal
    }

    // Título de um grupo de etapas (para expandir/recolher)
    if (e.target.classList.contains("step-name-toggle")) {
      const titleElement = e.target.parentElement;
      titleElement.classList.toggle("collapsed");
      const subtaskList = titleElement.nextElementSibling;
      if (subtaskList && subtaskList.classList.contains("subtask-list")) {
        subtaskList.classList.toggle("hidden");
      }
    }

    // Botão de deletar serviço
    const deleteBtn = e.target.closest(".btn-delete");
    if (deleteBtn) {
      const serviceId = deleteBtn.dataset.serviceId;
      if (confirm("Tem certeza que deseja deletar este serviço?")) {
        showLoading();
        try {
          await deleteDoc(doc(db, "services", serviceId));
          console.log("Serviço deletado com sucesso!");
          // A UI se atualizará automaticamente pelo onSnapshot
        } catch (error) {
          console.error("Erro ao deletar serviço:", error);
          alert("Falha ao deletar o serviço.");
        } finally {
          hideLoading();
        }
      }
    }

    // Lógica para upload de foto de perfil
    if (e.target.closest("#profile-picture-upload")) {
      document.getElementById("profile-picture-input").click();
    }

    // Lógica para selecionar um avatar predefinido
    if (e.target.classList.contains("preset-avatar")) {
      const newPhotoURL = e.target.dataset.url;
      const preview = document.getElementById("profile-picture-preview");
      preview.src = newPhotoURL; // Atualiza a visualização

      showLoading();
      try {
        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
        await updateUserInFirestore(auth.currentUser); // Salva no Firestore também
        userPhotoEl.src = newPhotoURL; // Atualiza o header
        alert("Avatar atualizado com sucesso!");
      } catch (error) {
        console.error("Erro ao atualizar avatar:", error);
        alert("Falha ao atualizar o avatar.");
      } finally {
        hideLoading();
      }
    }

    // MUDANÇA: Botão de editar serviço
    const editBtn = e.target.closest(".btn-edit");
    if (editBtn) {
      const serviceId = editBtn.dataset.serviceId;
      const serviceToEdit = services.find((s) => s.id === serviceId);
      if (serviceToEdit) {
        openEditModal(serviceToEdit);
      }
    }

    // MUDANÇA: Botão de remover etapa no modal de adicionar serviço
    const deleteStepBtn = e.target.closest(".btn-delete-step");
    if (deleteStepBtn) {
      // Remove a linha da etapa (o elemento pai do botão)
      deleteStepBtn.parentElement.remove();
    }

    // MUDANÇA: Botão de adicionar sub-etapa no modal
    const addSubstepBtn = e.target.closest(".btn-add-substep");
    if (addSubstepBtn) {
      const substepsContainer =
        addSubstepBtn.previousElementSibling;
      substepsContainer.appendChild(createSubstepInputRow());
    }

    // MUDANÇA: Botão de remover sub-etapa no modal
    const deleteSubstepBtn = e.target.closest(".btn-delete-substep");
    if (deleteSubstepBtn) {
      deleteSubstepBtn.parentElement.remove();
    }

    // MUDANÇA: Lógica para aprovar/rejeitar solicitações
    const approveBtn = e.target.closest(".btn-approve");
    if (approveBtn) {
      showLoading();
      const requestId = approveBtn.closest(".request-card").dataset.id;
      try {
        const requestDocRef = doc(db, "requests", requestId);
        const requestDoc = await getDoc(requestDocRef);

        if (requestDoc.exists()) {
          const requestData = requestDoc.data();

          // Prepara os dados para o novo serviço
          const newServiceData = {
            name: requestData.title,
            responsible: requestData.requesterId, // O solicitante se torna o responsável
            category: "Solicitações Aprovadas",
            steps: [
              {
                name: "Execução da Tarefa",
                subtasks: [{ name: requestData.description, completed: false }],
              },
            ],
            ownerId: currentUser.uid, // Quem aprovou é o "dono"
            files: [],
            createdAt: serverTimestamp(),
          };

          // Cria o novo serviço e atualiza a solicitação em uma única transação
          const batch = writeBatch(db);
          const newServiceRef = doc(servicesCollection);
          batch.set(newServiceRef, newServiceData);
          batch.update(requestDocRef, { status: "approved" });
          await batch.commit();

          alert("Solicitação aprovada e convertida em um novo serviço!");
          window.location.hash = ""; // Navega para a página principal
        }
      } catch (error) {
        console.error("Erro ao aprovar solicitação:", error);
        alert("Falha ao aprovar a solicitação e criar o serviço.");
      } finally {
        hideLoading();
      }
    }

    const rejectBtn = e.target.closest(".btn-reject");
    if (rejectBtn) {
      const requestId = rejectBtn.closest(".request-card").dataset.id;
      showLoading();
      const requestRef = doc(db, "requests", requestId);
      await updateDoc(requestRef, { status: "rejected" });
      // O onSnapshot cuidará de redesenhar a UI
    }
  });

  // MUDANÇA: Seletor de tipo de sub-etapa no modal
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("substep-type-selector")) {
      const selector = e.target;
      const stepGroup = selector.closest(".step-group-modal");
      const substepsContainer = stepGroup.querySelector(
        ".substeps-container-modal"
      );
      const addSubstepBtn = stepGroup.querySelector(".btn-add-substep");

      substepsContainer.innerHTML = ""; // Limpa as sub-etapas atuais

      if (selector.value === "units") {
        // Adiciona 4 unidades
        for (let i = 1; i <= 4; i++) {
          substepsContainer.appendChild(createSubstepInputRow(`Unidade 0${i}`));
        }
        addSubstepBtn.style.display = "none";
      } else {
        // 'text'
        substepsContainer.appendChild(createSubstepInputRow());
        addSubstepBtn.style.display = "inline-block";
      }
    }
  });
  // Gerenciador de 'change' para checkboxes e upload de arquivos
  document.addEventListener("change", async (e) => {
    // Checkbox de uma sub-tarefa na página de detalhes
    if (e.target.matches('#task-detail-view input[type="checkbox"]')) {
      const checkbox = e.target;
      const stepIndex = parseInt(checkbox.dataset.stepIndex, 10);
      const subtaskIndex = parseInt(checkbox.dataset.subtaskIndex, 10);
      const taskId = window.location.hash.substring("#/task/".length);

      const service = services.find((s) => s.id === taskId);
      if (service && !isNaN(stepIndex) && !isNaN(subtaskIndex)) {
        // Atualiza o estado localmente
        service.steps[stepIndex].subtasks[subtaskIndex].completed =
          checkbox.checked;

        // Salva a alteração no Firestore
        const serviceRef = doc(db, "services", taskId);
        await updateDoc(serviceRef, {
          steps: service.steps,
        });
      }
    }

    // MUDANÇA: Upload de nova foto de perfil
    if (e.target.id === "profile-picture-input") {
      const file = e.target.files[0];
      if (!file || !currentUser) return;

      const preview = document.getElementById("profile-picture-preview");
      const originalSrc = preview.src;
      preview.src = URL.createObjectURL(file); // Mostra preview local
      showLoading();

      try {
        const storageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
        await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(storageRef);

        // Atualiza no Auth e no Firestore
        await updateProfile(currentUser, { photoURL: newPhotoURL });
        await updateUserInFirestore(currentUser);

        // Atualiza a UI
        userPhotoEl.src = newPhotoURL;
        preview.src = newPhotoURL;
        alert("Foto de perfil atualizada!");
      } catch (error) {
        console.error("Erro ao fazer upload da foto:", error);
        alert("Falha ao atualizar a foto de perfil.");
        preview.src = originalSrc; // Reverte em caso de erro
      } finally {
        hideLoading();
      }
    }

    // MUDANÇA: Upload de arquivo na página de detalhes
    if (e.target.id === "file-upload-input") {
      const file = e.target.files[0];
      if (!file) return;

      const taskId = window.location.hash.substring("#/task/".length);
      showLoading();
      await uploadAndLinkFile(taskId, file);
      hideLoading();
    }

    // MUDANÇA: Checkbox de uma ETAPA na lista principal de serviços
    if (e.target.matches('#service-container input[type="checkbox"]')) {
      e.preventDefault(); // Impede a mudança visual imediata
      const checkbox = e.target;
      const serviceId = checkbox.closest(".service-card").dataset.id;
      const stepIndex = parseInt(checkbox.dataset.stepIndex, 10);

      const service = services.find((s) => s.id === serviceId);
      showLoading();
      if (service && !isNaN(stepIndex)) {
        // Marca/desmarca TODAS as sub-tarefas daquela etapa
        const allCompleted = checkbox.checked;
        service.steps[stepIndex].subtasks.forEach((st) => {
          st.completed = allCompleted;
        });

        // Salva a alteração no Firestore
        const serviceRef = doc(db, "services", serviceId);
        await updateDoc(serviceRef, {
          steps: service.steps,
        });
        hideLoading();
      }
    }
  });

  // MUDANÇA: Gerenciador de 'submit' para formulários dinâmicos
  document.addEventListener("submit", async (e) => {
    // Formulário de Comentários
    if (e.target.id === "comment-form") {
      e.preventDefault();
      const input = e.target.querySelector("#comment-input");
      const text = input.value.trim();
      if (!text) return;

      const taskId = window.location.hash.substring("#/task/".length);
      const commentData = {
        text: text,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        authorPhotoURL: currentUser.photoURL,
        createdAt: serverTimestamp(),
      };

      showLoading();
      try {
        const commentsColRef = collection(db, "services", taskId, "comments");
        await addDoc(commentsColRef, commentData);
        input.value = ""; // Limpa o campo
      } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        alert("Falha ao enviar o comentário.");
      } finally {
        hideLoading();
      }
    }

    // Formulário de Adicionar Link de Arquivo
    if (e.target.id === "add-file-form") {
      e.preventDefault();
      const input = e.target.querySelector("#file-url-input");
      const url = input.value.trim();
      if (!url) return;

      const taskId = window.location.hash.substring("#/task/".length);
      const fileName = url.substring(url.lastIndexOf("/") + 1) || url; // Tenta extrair um nome

      const fileData = { name: fileName, url: url, isLocal: false };
      showLoading();
      await addFileToService(taskId, fileData);
      hideLoading();
      input.value = "";
    }

    // Formulário de Perfil
    if (e.target.id === "profile-form") {
      e.preventDefault();
      const newName = document.getElementById("profile-name").value;
      const successMessage = document.getElementById("profile-success");

      showLoading();
      try {
        await updateProfile(currentUser, { displayName: newName });
        await updateUserInFirestore(currentUser); // Salva no Firestore
        userNameEl.textContent = newName; // Atualiza o header
        successMessage.classList.remove("hidden");
        setTimeout(() => successMessage.classList.add("hidden"), 3000);
      } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        alert("Falha ao salvar as alterações.");
      } finally {
        hideLoading();
      }
    }
  });

  // --- LÓGICA PRINCIPAL DE AUTENTICAÇÃO E EVENTOS ---

  onAuthStateChanged(auth, async (user) => {
    // Esta função é chamada sempre que o estado de login do usuário muda.
    if (user) {
      // --- O USUÁRIO ESTÁ LOGADO ---
      currentUser = user;
      console.log("Usuário logado:", currentUser.uid);

      // Garante que o perfil do usuário no Firestore está atualizado com nome, email, etc.
      await updateUserInFirestore(user);

      // MUDANÇA: Carrega a lista de membros da equipe para usar na aplicação
      await loadTeamMembers();

      // Atualiza a UI para o estado "logado"
      userNameEl.textContent = currentUser.displayName || currentUser.email;
      userPhotoEl.src = currentUser.photoURL || "./assets/default-avatar.png"; // Use um avatar padrão se não houver foto

      // MUDANÇA: Mostra todos os botões de ação para qualquer usuário logado
      addServiceBtn.classList.remove("hidden");
      requestsLink.classList.remove("hidden");
      makeRequestBtn.classList.remove("hidden");

      loginContainer.classList.add("hidden");
      appHeader.classList.remove("hidden");
      userProfile.classList.remove("hidden");
      serviceContainer.classList.remove("hidden");

      // Começa a ouvir por atualizações nos serviços do usuário em tempo real
      listenForServices(user);

      // Verifica a URL (ex: #/task/some-id) para mostrar a view correta no carregamento
      handleRouteChange(); // MUDANÇA: Chamada inicial ao roteador
      window.addEventListener("hashchange", handleRouteChange); // MUDANÇA: Ouve por mudanças na URL

      // MUDANÇA: Adiciona o listener para a barra de pesquisa
      searchInput.addEventListener("input", renderServices);
    } else {
      // --- O USUÁRIO ESTÁ DESLOGADO ---
      currentUser = null;
      console.log("Nenhum usuário logado.");

      // Se houver um listener de serviços ativo, remove-o para evitar erros
      if (unsubscribeFromServices) {
        unsubscribeFromServices();
        window.removeEventListener("hashchange", handleRouteChange); // MUDANÇA: Remove o listener
        unsubscribeFromServices = null;

        // MUDANÇA: Remove o listener da barra de pesquisa ao deslogar
        searchInput.removeEventListener("input", renderServices);
        searchInput.value = ''; // Limpa a busca
      }
      // MUDANÇA: Desliga o listener de solicitações também
      if (unsubscribeFromRequests) {
        unsubscribeFromRequests();
        unsubscribeFromRequests = null;
      }
      // MUDANÇA: Desliga o listener de comentários também
      if (unsubscribeFromComments) {
        unsubscribeFromComments();
        unsubscribeFromComments = null;
      }

      // Limpa os dados locais da aplicação
      services = [];
      teamMembers = [];
      teamMemberMap.clear();

      // Atualiza a UI para o estado "deslogado", mostrando a tela de login
      loginContainer.classList.remove("hidden");
      appHeader.classList.add("hidden");
      userProfile.classList.add("hidden");
      serviceContainer.classList.add("hidden");
      taskDetailView.classList.add("hidden");
      profileView.classList.add("hidden");
      requestsView.classList.add("hidden");

      // Garante que o layout volte ao normal
      document.body.classList.remove("detail-view-active");
    }
  });

  // Evento de login com E-mail e Senha
  emailLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailLoginForm["login-email"].value;
    const password = emailLoginForm["login-password"].value;
    loginErrorEl.classList.add("hidden");

    showLoading();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged cuidará de atualizar a UI
    } catch (error) {
      console.error("Erro no login:", error);
      loginErrorEl.textContent = "E-mail ou senha inválidos.";
      loginErrorEl.classList.remove("hidden");
    } finally {
      hideLoading();
    }
  });

  // Evento de login com Google
  googleLoginBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      showLoading();
      await signInWithPopup(auth, provider); // Aguarda o popup ser fechado
      // O onAuthStateChanged cuidará de atualizar a UI, mas podemos esconder o loading aqui.
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error("Erro no login com Google:", error);
      // MUDANÇA: Mensagem de erro mais específica
      if (error.code === 'auth/account-exists-with-different-credential') {
          loginErrorEl.textContent = "Já existe uma conta com este e-mail. Tente fazer login com o método original.";
      } else if (error.code === 'auth/popup-blocked-by-browser') {
          loginErrorEl.textContent = "O pop-up de login foi bloqueado pelo navegador. Por favor, habilite os pop-ups para este site.";
      } else if (error.code === 'auth/operation-not-allowed') {
          loginErrorEl.textContent = "Login com Google não está habilitado no Firebase. Verifique as configurações.";
      } else if (error.code === 'auth/unauthorized-domain') {
          loginErrorEl.textContent = "Este domínio não está autorizado para login. Use um servidor local (Live Server).";
      } else if (error.code === 'auth/popup-closed-by-user') {
          loginErrorEl.textContent = "A janela de login foi fechada antes da conclusão.";
      } else {
          loginErrorEl.textContent = "Falha ao autenticar com o Google. Verifique sua conexão.";
      }
      loginErrorEl.classList.remove("hidden");
    }
  });

  // Evento de registro com E-mail e Senha
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = registerForm["register-name"].value;
    const email = registerForm["register-email"].value;
    const password = registerForm["register-password"].value;
    registerErrorEl.classList.add("hidden");

    showLoading();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      // Atualiza o perfil do novo usuário com o nome fornecido
      await updateProfile(userCredential.user, { displayName: name });
      // O onAuthStateChanged cuidará de logar o usuário e atualizar a UI
    } catch (error) {
      console.error("Erro no registro:", error);
      registerErrorEl.textContent =
        "Erro ao criar conta. Verifique os dados ou tente outro e-mail.";
      registerErrorEl.classList.remove("hidden");
    } finally {
      hideLoading();
    }
  });

  // Evento para o botão de Sair
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
  });

  // Eventos para alternar entre as telas de login e registro
  toggleToRegister.addEventListener("click", () => {
    loginBox.classList.add("hidden");
    registerBox.classList.remove("hidden");
  });

  // MUDANÇA: Evento para o botão de menu mobile
  mobileMenuToggle.addEventListener("click", () => {
    headerMenuItems.classList.toggle("open");
  });
  toggleToLogin.addEventListener("click", () => {
    registerBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
  });

  // --- MUDANÇA: LÓGICA DOS MODAIS ---

  function populateTeamMemberSelects() {
    const select = document.getElementById("responsibleName");
    if (!select) return;
    const optionsHtml = teamMembers
      .map((member) => `<option value="${member.id}">${member.name}</option>`)
      .join("");
    select.innerHTML = optionsHtml;
  }

  // MUDANÇA: Função para abrir o modal em modo de edição
  function openEditModal(service) {
    currentEditServiceId = service.id;

    populateTeamMemberSelects();

    // Preenche o formulário com os dados do serviço
    addServiceForm.querySelector('[name="serviceName"]').value = service.name;
    addServiceForm.querySelector('[name="responsibleName"]').value =
      service.responsible;
    addServiceForm.querySelector('[name="serviceCategory"]').value =
      service.category || "";

    // MUDANÇA: Limpa e preenche as etapas e sub-etapas corretamente
    stepsContainer.innerHTML = "";
    service.steps.forEach((step) => {
      stepsContainer.appendChild(createStepGroupElement(step));
    });

    // Altera o título e o botão do modal
    modal.querySelector("h2").textContent = "Editar Serviço";
    modal.querySelector('button[type="submit"]').textContent =
      "Salvar Alterações";

    modal.style.display = "block";
  }

  // Abrir modal de "Adicionar Serviço"
  addServiceBtn.addEventListener("click", () => {
    addServiceForm.reset(); // Limpa o formulário
    // MUDANÇA: Limpa o container e adiciona o primeiro grupo de etapa/sub-etapa
    stepsContainer.innerHTML = "";
    stepsContainer.appendChild(createStepGroupElement());
    populateTeamMemberSelects();

    // MUDANÇA: Garante que o modal esteja em modo de "adição"
    currentEditServiceId = null;
    modal.querySelector("h2").textContent = "Adicionar Novo Serviço";
    modal.querySelector('button[type="submit"]').textContent = "Criar Serviço";

    modal.style.display = "block";
  });

  // Abrir modal de "Fazer Solicitação"
  makeRequestBtn.addEventListener("click", () => {
    makeRequestForm.reset();
    makeRequestModal.style.display = "block";
  });

  // Fechar modais (botão 'X' e clique fora)
  document.querySelectorAll(".modal").forEach((m) => {
    // Botão 'X'
    const closeBtn = m.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        m.style.display = "none";
        // MUDANÇA: Destrói a instância do Sortable se for o modal de serviço
        if (m.id === "add-service-modal" && sortableSteps) {
          sortableSteps.destroy();
          sortableSteps = null;
        }
      });
    }
    // Clique fora do conteúdo do modal
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        m.style.display = "none";
        // MUDANÇA: Destrói a instância do Sortable se for o modal de serviço
        if (m.id === "add-service-modal" && sortableSteps) {
          sortableSteps.destroy();
          sortableSteps = null;
        }
      }
    });
  });

  // Adicionar nova etapa no formulário de serviço
  addStepBtn.addEventListener("click", () => {
    // MUDANÇA: Adiciona um grupo completo de etapa/sub-etapa
    stepsContainer.appendChild(createStepGroupElement());
  });

  // Enviar formulário de "Adicionar Serviço"
  addServiceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(addServiceForm);
    const serviceName = formData.get("serviceName");
    const responsibleId = formData.get("responsibleName");
    const category = formData.get("serviceCategory");

    // MUDANÇA: Lógica para coletar etapas e sub-etapas
    const stepGroups = stepsContainer.querySelectorAll(".step-group-modal");
    const steps = Array.from(stepGroups).map((group) => {
      const stepName = group.querySelector('[name="stepName"]').value;
      const substepInputs = group.querySelectorAll('[name="substepName"]');
      const subtasks = Array.from(substepInputs).map((input) => ({
        name: input.value,
        completed: false,
      }));
      // Garante que haja pelo menos uma sub-etapa se nenhuma for adicionada
      return { name: stepName, subtasks: subtasks.length > 0 ? subtasks : [{ name: "Tarefa Padrão", completed: false }] };
    });

    const serviceData = {
      name: serviceName,
      responsible: responsibleId,
      category: category,
      steps: steps,
      ownerId: currentUser.uid,
      files: [], // Manter os arquivos existentes ao editar (lógica futura)
      // O createdAt não é atualizado na edição
    };

    showLoading();
    try {
      if (currentEditServiceId) {
        // --- MODO EDIÇÃO ---
        const serviceRef = doc(db, "services", currentEditServiceId);
        // Não sobrescrevemos a data de criação
        const { createdAt, files, ...updateData } = serviceData;
        await updateDoc(serviceRef, updateData);
        alert("Serviço atualizado com sucesso!");
      } else {
        // --- MODO ADIÇÃO ---
        await addDoc(servicesCollection, {
          ...serviceData,
          createdAt: serverTimestamp(),
        });
        alert("Serviço adicionado com sucesso!");
      }

      modal.style.display = "none";
      currentEditServiceId = null; // Limpa o ID de edição
      // MUDANÇA: Destrói a instância do Sortable após salvar
      if (sortableSteps) {
        sortableSteps.destroy();
        sortableSteps = null;
      }
    } catch (error) {
      console.error("Erro ao salvar serviço:", error);
      alert("Falha ao salvar o serviço.");
    } finally {
      hideLoading();
    }
  });

  // Enviar formulário de "Fazer Solicitação"
  makeRequestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = makeRequestForm["request-title"].value;
    const description = makeRequestForm["request-description"].value;

    showLoading();
    try {
      await addDoc(requestsCollection, {
        title,
        description,
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName || currentUser.email,
        status: "pending", // 'pending', 'approved', 'rejected'
        createdAt: serverTimestamp(),
      });
      makeRequestModal.style.display = "none";
      alert("Solicitação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      alert("Falha ao enviar a solicitação.");
    } finally {
      hideLoading();
    }
  });

  // --- MUDANÇA: Funções auxiliares para criar elementos do formulário ---

  // Cria uma linha de input para uma sub-etapa
  function createSubstepInputRow(name = "") {
    const row = document.createElement("div");
    row.className = "substep-input-row";
    row.innerHTML = `
      <input type="text" name="substepName" placeholder="Nome da sub-etapa" value="${name}" required />
      <button type="button" class="btn-icon btn-delete-substep" title="Remover Sub-etapa"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
    `;
    return row;
  }

  // Cria um grupo completo de etapa (com container de sub-etapas e botões)
  function createStepGroupElement(step = null) {
    const group = document.createElement("div");
    group.className = "step-group-modal";

    const stepName = step ? step.name : "";
    const subtasks = step
      ? step.subtasks
      : [{ name: "Tarefa Padrão", completed: false }];

    // Determina o tipo inicial com base na estrutura das sub-tarefas
    const isUnitsType =
      step &&
      step.subtasks.length === 4 &&
      step.subtasks.every((st, i) => st.name === `Unidade 0${i + 1}`);
    const initialType = isUnitsType ? "units" : "text";

    group.innerHTML = `
      <div class="drag-handle" title="Arraste para reordenar">⠿</div>
      <div class="step-input-row">
        <input type="text" name="stepName" placeholder="Nome da etapa principal" value="${stepName}" required />
        <button type="button" class="btn-icon btn-delete-step" title="Remover Etapa"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
      </div>
      <div class="form-group">
        <label>Tipo de Sub-etapa</label>
        <select class="substep-type-selector">
            <option value="text" ${initialType === "text" ? "selected" : ""}>Texto Livre</option>
            <option value="units" ${initialType === "units" ? "selected" : ""}>4 Unidades</option>
        </select>
      </div>
      <div class="substeps-container-modal">
        ${subtasks.map(st => createSubstepInputRow(st.name).outerHTML).join("")}
      </div>
      <button type="button" class="btn-secondary btn-add-substep" style="width: auto; padding: 5px 10px; font-size: 0.9em; margin-top: 10px; display: ${initialType === 'units' ? 'none' : 'inline-block'};">+ Sub-etapa</button>
    `;

    return group;
  }

  // --- MUDANÇA: Funções auxiliares para upload de arquivos ---
  async function addFileToService(serviceId, fileData) {
    const serviceRef = doc(db, "services", serviceId);
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const updatedFiles = [...(service.files || []), fileData];

    try {
      await updateDoc(serviceRef, { files: updatedFiles });
      // A UI será atualizada pelo onSnapshot principal
    } catch (error) {
      console.error("Erro ao adicionar arquivo:", error);
      alert("Falha ao adicionar o arquivo.");
    }
  }

  async function uploadAndLinkFile(serviceId, file) {
    const storageRef = ref(storage, `services/${serviceId}/${file.name}`);
    try {
      // O spinner global já está visível
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await addFileToService(serviceId, {
        name: file.name,
        url: downloadURL,
        isLocal: true,
      });
      alert("Arquivo carregado com sucesso!");
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Falha no upload do arquivo.");
    }
  }
});
