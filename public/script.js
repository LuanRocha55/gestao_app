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
  sendPasswordResetEmail,
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
const categoriesCollection = collection(db, "categories"); // MUDANÇA: Coleção para categorias pré-definidas
const notificationsCollection = collection(db, "notifications"); // MUDANÇA: Coleção para notificações

document.addEventListener("DOMContentLoaded", () => {
  // --- MUDANÇA: Variáveis de estado e elementos da UI ---
  let currentUser = null;
  let services = [];
  let teamMembers = [];
  let teamMemberMap = new Map();
  let predefinedCategories = []; // MUDANÇA: Para armazenar categorias do admin
  let allUsersData = []; // MUDANÇA: Variável para armazenar dados de todos os usuários
  let currentEditServiceId = null; // MUDANÇA: Para rastrear o serviço em edição
  let sortableSteps = null; // MUDANÇA: Para a instância do SortableJS
  let unsubscribeFromComments = null; // MUDANÇA: Listener para comentários
  let unsubscribeFromRequests = null; // MUDANÇA: Listener para solicitações
  let unsubscribeFromNotifications = null; // MUDANÇA: Listener para notificações
  let unsubscribeFromServices = null; // Para parar de ouvir os dados ao fazer logout

  // --- MUDANÇA: Elementos de Autenticação expandidos ---
  const loginContainer = document.getElementById("login-container"); // Container principal
  const loginBox = document.getElementById("login-box");
  const registerBox = document.getElementById("register-box");
  const emailLoginForm = document.getElementById("email-login-form");
  const continueAsBox = document.getElementById("continue-as-box"); // MUDANÇA
  const continueAsBtn = document.getElementById("continue-as-btn"); // MUDANÇA
  const switchAccountLink = document.getElementById("switch-account-link"); // MUDANÇA
  const googleLoginBtn = document.getElementById("google-login-btn");
  const registerForm = document.getElementById("register-form");
  const toggleToRegister = document.getElementById("toggle-to-register");
  const toggleToLogin = document.getElementById("toggle-to-login");
  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const loginErrorEl = document.getElementById("login-error");
  const registerErrorEl = document.getElementById("register-error");
  const logoutBtn = document.getElementById("logout-btn");
  const appHeader = document.getElementById("app-header");
  const userProfile = document.getElementById("user-profile");
  const userNameEl = document.getElementById("user-name");
  const userPhotoEl = document.getElementById("user-photo");
  const serviceContainer = document.getElementById("service-container");
  const themeToggle = document.getElementById("theme-toggle");
  const modal = document.getElementById("add-service-modal");
  const addServiceForm = document.getElementById("add-service-form");
  const serviceListWrapper = document.getElementById("service-list-wrapper");
  const taskDetailView = document.getElementById("task-detail-view");
  const profileView = document.getElementById("profile-view");
  const requestsView = document.getElementById("requests-view");
  const userManagementView = document.getElementById("user-management-view");
  const categoryManagementView = document.getElementById("category-management-view");
  const addStepBtn = document.getElementById("add-step-btn");
  const dashboardView = document.getElementById("dashboard-view");
  const stepsContainer = document.getElementById("steps-container");
  const makeRequestModal = document.getElementById("make-request-modal");
  const makeRequestForm = document.getElementById("make-request-form");
  const editSubtaskModal = document.getElementById("edit-subtask-modal");
  const loadingOverlay = document.getElementById("loading-overlay");
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const headerMenuItems = document.getElementById("header-menu-items");
  const notificationContainer = document.getElementById("notification-container");
  const notificationBell = document.getElementById("notification-bell");
  const notificationCount = document.getElementById("notification-count");
  const notificationPanel = document.getElementById("notification-panel");

  // MUDANÇA: Opções pré-definidas para o select de pendências.
  const pendingOptions = [
    "Aguardando material do cliente",
    "Revisão interna necessária",
    "Bloqueado por outra tarefa",
    "Aguardando aprovação",
    "Dúvida técnica",
  ];

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
        orderIndex: 1, // MUDANÇA: Adiciona índice de ordenação
        priority: "Alta", // MUDANÇA: Adiciona prioridade
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vence em 15 dias
        files: [],
        steps: [
          {
            name: "Conteudista",
            responsibleId: user.uid, // MUDANÇA: Adiciona responsável pela etapa
            // MUDANÇA: Garante que a estrutura de sub-tarefas sempre exista
            subtasks: [
              { name: "Tarefa Padrão", completed: false },
              { name: "Unidade 1", completed: true },
              { name: "Unidade 2", completed: true },
              { name: "Unidade 3", completed: true },
              { name: "Unidade 4", completed: true },
            ],
          },
          {
            name: "DI",
            color: "#ffc107",
            responsibleId: null, // MUDANÇA: Etapa sem responsável definido
            subtasks: [
              { name: "Unidade 1", completed: true },
              { name: "Unidade 2", completed: false },
              { name: "Unidade 3", completed: false },
              { name: "Unidade 4", completed: false },
            ],
          },
          {
            name: "PDF",
            color: "#28a745",
            responsibleId: null,
            subtasks: [
              { name: "Unidade 1", completed: false },
              { name: "Unidade 2", completed: false },
              { name: "Unidade 3", completed: false },
              { name: "Unidade 4", completed: false },
            ],
          },
          {
            name: "AudioVisual",
            color: "#dc3545",
            responsibleId: null,
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
        orderIndex: 2, // MUDANÇA: Adiciona índice de ordenação
        priority: "Média", // MUDANÇA: Adiciona prioridade
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Venceu há 2 dias
        color: "#17a2b8",
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
      displayName: user.displayName || user.email,
      email: user.email,
      photoURL: user.photoURL,
    };
    // Usa set com merge:true para criar ou atualizar.
    // Se o documento não existir, adiciona o campo 'role' como 'member'.
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) userData.role = "member";

    // MUDANÇA: Promove o primeiro usuário a admin se não houver outros admins
    const adminsQuery = query(usersCollection, where("role", "==", "admin"));
    const adminSnapshot = await getDocs(adminsQuery);
    if (adminSnapshot.empty) {
        console.log("Nenhum admin encontrado. Promovendo o primeiro usuário.");
        userData.role = "admin";
    }

    await setDoc(userDocRef, userData, { merge: true });

    // MUDANÇA: Atualiza o objeto currentUser local se o cargo foi alterado
    if (currentUser && currentUser.uid === user.uid) {
        currentUser.role = userData.role;
    }
  }

  async function loadTeamMembers() {
    const querySnapshot = await getDocs(usersCollection);
    teamMembers = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: data.uid, name: data.displayName || data.email };
    });
    teamMemberMap = new Map(teamMembers.map((m) => [m.id, m.name]));
    // MUDANÇA: Carrega todos os dados do usuário para a página de admin
    allUsersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  // MUDANÇA: Função para carregar categorias pré-definidas
  async function loadPredefinedCategories() {
    const querySnapshot = await getDocs(categoriesCollection);
    predefinedCategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordena alfabeticamente
    predefinedCategories.sort((a, b) => a.name.localeCompare(b.name));
  }

  // --- MUDANÇA: Funções para a página de solicitações ---
  function renderRequestsPage() {
    // MUDANÇA: Adiciona a barra de pesquisa à página de solicitações
    requestsView.innerHTML = `
            <div class="detail-header requests-header">
                <h2>Gerenciar Solicitações</h2>
                <button id="make-request-btn" class="btn-primary">Fazer Solicitação</button>
                <a href="#/" class="btn-secondary">Voltar ao Dashboard</a>
            </div>
            <div class="search-bar-wrapper">
                <input type="search" id="requests-search-input" placeholder="Pesquisar por título, solicitante, descrição...">
            </div>
            <div id="requests-list-container"></div>
        `;

    listenForRequests();

    // MUDANÇA: Adiciona o listener para a nova barra de pesquisa
    document.getElementById('requests-search-input').addEventListener('input', listenForRequests);
  }

  function listenForRequests() {
    const listContainer = document.getElementById("requests-list-container");
    if (!listContainer) return;

    // MUDANÇA: Garante que não haja listeners duplicados
    if (unsubscribeFromRequests) {
      unsubscribeFromRequests();
    }

    const q = query(requestsCollection, orderBy("createdAt", "desc"));

    // MUDANÇA: Pega o termo da busca para filtrar os resultados
    const searchInput = document.getElementById('requests-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // MUDANÇA: Armazena a função de unsubscribe
    unsubscribeFromRequests = onSnapshot(q, (querySnapshot) => {
      const allRequests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateDashboardBadges(allRequests); // MUDANÇA: Atualiza o selo no dashboard

      if (querySnapshot.empty) {
        listContainer.innerHTML = "<p>Nenhuma solicitação encontrada.</p>";
        return;
      }

      // Filtra as solicitações com base no termo de busca
      const filteredRequests = allRequests.filter(request => {
          if (!searchTerm) return true;
          return request.title.toLowerCase().includes(searchTerm) ||
                 request.description.toLowerCase().includes(searchTerm) ||
                 request.requesterName.toLowerCase().includes(searchTerm);
      });

      if (filteredRequests.length === 0) {
        listContainer.innerHTML = `<p class="no-results">Nenhuma solicitação encontrada para "${searchTerm}".</p>`;
        return;
      }

      const requestsByStatus = {
        pending: [],
        approved: [],
        rejected: [],
      };

      filteredRequests.forEach((request) => {
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
            
            const mentionHtml = request.mentionedUserId 
              ? `<div class="request-mention">Mencionado: <span>${teamMemberMap.get(request.mentionedUserId) || 'Usuário desconhecido'}</span></div>` 
              : '';

            const statusIconsSvg = {
                pending: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/></svg>', // Ícone de relógio
                approved: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/></svg>', // Ícone de check
                rejected: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2C17.5,2 22,6.5 22,12S17.5,22 12,22 2,17.5 2,12 6.5,2 12,2M17,15.59L15.59,17L12,13.41L8.41,17L7,15.59L10.59,12L7,8.41L8.41,7L12,10.59L15.59,7L17,8.41L13.41,12L17,15.59Z"/></svg>'  // Ícone de X
            };
            const statusIcon = statusIconsSvg[request.status] || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>';

            card.innerHTML = `
                <div class="request-card-header">
                    <div class="request-card-title">
                        <img src="${request.requesterPhotoURL || './assets/default-avatar.png'}" alt="Avatar de ${request.requesterName}">
                        <h3>${request.title}</h3>
                    </div>
                    <div class="request-status-icon" title="Status: ${request.status}">${statusIcon}</div>
                </div>
                <div class="request-meta">Solicitado por <span>${request.requesterName}</span> em <span>${date}</span></div>
                ${mentionHtml}
                <p class="request-description">${request.description}</p>
                ${request.status === "pending" ? `
                    <div class="request-actions">
                        <button class="btn-primary btn-approve">Aprovar</button>
                        <button class="btn-primary btn-reject">Rejeitar</button>
                    </div>` : ""
                }`;
            listContainer.appendChild(card);
          });
        }
      });
    });
  }

  // MUDANÇA: Função para atualizar os selos de contagem no dashboard
  // CORREÇÃO: Refatorada para garantir a criação e posicionamento corretos do selo.
  function updateDashboardBadges(allRequests) {
    const pendingCount = allRequests.filter(
      (req) => req.status === "pending"
    ).length;
    const card = document.getElementById("requests-dashboard-card");
    if (!card) return;
 
    let badge = card.querySelector(".dashboard-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "dashboard-badge";
      card.appendChild(badge);
    }
 
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove("hidden"); // Garante que o selo esteja visível
    } else {
      badge.classList.add("hidden"); // Esconde o selo se não houver notificações
    }
  }

  // MUDANÇA: Nova função para verificar o status da data de entrega
  function getDueDateStatus(dueDateString) {
    if (!dueDateString) {
      return { text: '', className: '' };
    }

    const dueDate = new Date(dueDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // CORREÇÃO: Ajusta a data de entrega para o início do dia no fuso horário local para evitar erros de cálculo.
    const comparisonDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const diffTime = comparisonDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (diffDays < 0) {
      return { text: `Atrasado (${formattedDate})`, className: 'overdue' };
    }
    if (diffDays === 0) {
      return { text: `Vence Hoje (${formattedDate})`, className: 'due-soon' };
    }
    if (diffDays === 1) {
      return { text: `Vence Amanhã (${formattedDate})`, className: 'due-soon' };
    }
    if (diffDays <= 7) {
      return { text: `Vence em ${diffDays} dias (${formattedDate})`, className: 'due-soon' };
    }

    return { text: `Entrega: ${formattedDate}`, className: '' };
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

  // --- MUDANÇA: Função para Renderizar APENAS a lista de cartões de serviço ---
  function renderServiceCards() {
    const searchInput = document.getElementById('services-search-input');
    if (!searchInput) return; // Sai se a barra de busca não existir

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

    // MUDANÇA: Pega a referência do wrapper recém-criado
    const currentServiceListWrapper = document.getElementById("service-list-wrapper");

    if (servicesToRender.length === 0 && searchTerm) {
      currentServiceListWrapper.innerHTML = `<p class="no-results">Nenhum serviço encontrado para "${searchInput.value}".</p>`;
      return;
    }

    // MUDANÇA: Separa os serviços em ativos e concluídos
    const activeServices = [];
    const completedServices = [];

    servicesToRender.forEach(service => {
        if (calculateOverallProgress(service).percentage === 100) {
            completedServices.push(service);
        } else {
            activeServices.push(service);
        }
    });

    // 1. Agrupa apenas os serviços ativos por categoria
    const groupedActiveServices = activeServices.reduce((acc, service) => {
      const category = service.category || "Outros";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    }, {});

    // MUDANÇA: Limpa a lista atual antes de adicionar os novos resultados filtrados.
    currentServiceListWrapper.innerHTML = '';

    // MUDANÇA: Usa um DocumentFragment para melhorar a performance da renderização,
    // montando todos os elementos em memória antes de adicioná-los ao DOM de uma só vez.
    const mainFragment = document.createDocumentFragment();

    // MUDANÇA: Limpa a lista atual antes de adicionar os novos resultados filtrados.
    currentServiceListWrapper.innerHTML = '';

    // MUDANÇA: Função para renderizar um grupo de categoria
    const renderCategoryGroup = (category, services) => {
        // Cria e adiciona o título da categoria
        const titleEl = document.createElement("h3");
        titleEl.className = "category-title";
        // MUDANÇA: Aplica a cor da categoria na borda inferior do título
        const categoryData = predefinedCategories.find(c => c.name === category);
        if (categoryData && categoryData.color) {
            titleEl.style.borderBottomColor = categoryData.color;
        }
        titleEl.textContent = category;
        mainFragment.appendChild(titleEl);

        // MUDANÇA: Cria um container para os cartões da categoria, que será o alvo do SortableJS
        const cardContainer = document.createElement('div');
        cardContainer.className = 'service-card-grid';
        cardContainer.dataset.category = category; // Armazena a categoria no container

        // Renderiza os cards dentro da categoria
        // MUDANÇA: Ordena os serviços pelo orderIndex antes de renderizar
        services
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
          .forEach((service) => {

          // MUDANÇA: O cartão agora tem um data-id para identificação no drag-and-drop
          const card = document.createElement("div");
          card.className = "service-card";
          card.dataset.id = service.id;

          // MUDANÇA: Adiciona ícone de alerta se houver pendências
          let pendingAlertHtml = '';
          if (hasPendingIssuesInService(service)) {
            pendingAlertHtml = `
              <span class="alert-icon" title="Este serviço possui pendências em sub-etapas.">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L1 21H23L12 2ZM13 8V14H11V8H13ZM13 16V18H11V16H13Z"/></svg>
              </span>
            `;
          }



          // MUDANÇA: O progresso agora é baseado nas sub-tarefas
          const progress = calculateOverallProgress(service);

          // MUDANÇA: Verifica o status da data de entrega
          const dueDateStatus = getDueDateStatus(service.dueDate);
          let dueDateHtml = '';
          if (dueDateStatus.text) {
              dueDateHtml = `
                  <div class="due-date-info ${dueDateStatus.className}">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
                      <span>${dueDateStatus.text}</span>
                  </div>`;
          }
          const responsibleName =
            teamMemberMap.get(service.responsible) || "Não atribuído";

          // MUDANÇA: Adiciona a tag de prioridade
          const priority = service.priority || "Média";
          const priorityTagHtml = `<span class="priority-tag ${priority.toLowerCase()}">${priority}</span>`;

          // CORREÇÃO: Restaura a inicialização do sortable para as etapas do card
          const stepsListId = `steps-list-${service.id}`;
          card.addEventListener('mouseenter', () => {
              initializeCardStepSorting(stepsListId, service.id);
          });
 
          // MUDANÇA: Adiciona classe se o serviço estiver completo
          if (progress.percentage === 100) {
              card.classList.add('service-completed');
          }

          // MUDANÇA: Gera o HTML para as pendências que aparecerão no card.
          let cardPendingIssuesHtml = '';
          const pendingSteps = service.steps.filter(step => hasPendingIssuesInStep(step));
          if (pendingSteps.length > 0) {
              const issuesList = pendingSteps.map(step => `
                  <div class="card-pending-item">
                      <span class="alert-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L1 21H23L12 2ZM13 8V14H11V8H13ZM13 16V18H11V16H13Z"/></svg>
                      </span>
                      <span style="color: var(--pending-color, #c78100); font-weight: 600;">${step.name}</span>
                  </div>
              `).join('');
              cardPendingIssuesHtml = `<div class="card-pending-issues">${issuesList}</div>`;
          }

          card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title-wrapper">
                            <h2><a href="#/service/${service.id}">${service.name}</a></h2>
                        </div>
                        <div class="card-actions">
                            <button class="btn-icon btn-edit" title="Editar Serviço" data-service-id="${
                              service.id
                            }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65,21.1,6,20.71,5.63L18.37,3.29C18,2.9,17.35,2.9,16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></button>
                            <button class="btn-icon btn-delete" title="Deletar Serviço" data-service-id="${
                              service.id
                            }"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
                        </div>
                    </div>
                    <div class="card-meta-info">
                        ${priorityTagHtml}
                    </div>
                    <p class="responsible">Responsável: ${responsibleName}</p>
                    ${dueDateHtml}
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
                    ${cardPendingIssuesHtml}
                    ${progress.percentage === 100 ?
                        `<button class="btn-secondary btn-reopen" data-service-id="${service.id}" style="width: 100%; margin-top: 15px;">Reabrir Serviço</button>` :
                        '' // Remove a lista de etapas do card
                    }
                `;
          cardContainer.appendChild(card);
        });
        mainFragment.appendChild(cardContainer);
    };

    // 2. Renderiza os grupos de serviços ativos
    Object.keys(groupedActiveServices)
      .sort()
      .forEach((category) => {
        renderCategoryGroup(category, groupedActiveServices[category]);
      });

    // 3. Renderiza a categoria de serviços concluídos, se houver
    if (completedServices.length > 0) {
        renderCategoryGroup("Concluídos", completedServices);
    }

    currentServiceListWrapper.appendChild(mainFragment);

    // MUDANÇA: Inicializa o SortableJS para todos os containers de categoria
    initializeServiceCardSorting();
  }

  // MUDANÇA: Nova função para verificar se há pendências em uma sub-tarefa
  function hasPendingIssues(subtask) {
    return subtask.pendingDescription && subtask.pendingDescription.trim() !== '';
  }

  // MUDANÇA: Nova função para verificar se há pendências em uma etapa
  function hasPendingIssuesInStep(step) {
    return (step.subtasks || []).some(hasPendingIssues);
  }

  // MUDANÇA: Nova função para verificar se há pendências em um serviço
  function hasPendingIssuesInService(service) {
    return (service.steps || []).some(hasPendingIssuesInStep);
  }


  // MUDANÇA: Nova função para calcular o progresso de uma única etapa
  function calculateStepProgress(step) {
    const subtasks = step.subtasks || [];
    if (subtasks.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    const completedSubtasks = subtasks.filter((st) => st.completed).length;
    const totalSubtasks = subtasks.length;
    return {
      completed: completedSubtasks,
      total: totalSubtasks,
      percentage: totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0,
    };
  }
  // --- Funções da Página de Detalhes do Serviço ---
  function renderServiceDetail(service, openSteps = [], isEditing = false) {
    // MUDANÇA: Seleciona os containers que serão atualizados
    const serviceNameEl = document.getElementById('detail-service-name');
    const headerActionsContainer = taskDetailView.querySelector('.detail-header-actions');
    const generalInfoContent = document.getElementById('detail-general-info-content');
    const stepsList = document.getElementById('detailed-steps-list');
    const fileList = document.getElementById('file-list');
    const stickyFooterContainer = document.getElementById('detail-sticky-footer-container');

    if (!serviceNameEl || !headerActionsContainer || !generalInfoContent || !stepsList || !fileList || !stickyFooterContainer) return;

    const responsibleName =
      teamMemberMap.get(service.responsible) || "Não atribuído";
    const progress = calculateOverallProgress(service);

    // MUDANÇA: Adiciona o status da data de entrega na página de detalhes
    const dueDateStatus = getDueDateStatus(service.dueDate);
    let dueDateDetailHtml = '<p><strong>Data de Entrega:</strong> Não definida</p>';
    if (dueDateStatus.text) {
        dueDateDetailHtml = `<p class="due-date-info ${dueDateStatus.className}" style="width: 100%; justify-content: center;"><strong>${dueDateStatus.text}</strong></p>`;
    }

    // MUDANÇA: Adiciona a prioridade na página de detalhes
    const priority = service.priority || "Média";
    const priorityDetailHtml = `<p><strong>Prioridade:</strong> <span class="priority-tag-detail ${priority.toLowerCase()}">${priority}</span></p>`;

    // --- MUDANÇA: Lógica para renderizar modo de visualização ou edição ---
    let generalInfoHtml;
    let stepsHtml;
    let headerActionsHtml;

    // Atualiza o título do serviço
    serviceNameEl.innerHTML = `${service.name} ${progress.percentage === 100 ? '<span class="completion-badge">Concluído</span>' : ''}`;

    if (isEditing) {
        // MODO EDIÇÃO
        headerActionsHtml = ``; // Botões movidos para o footer sticky

        // Formulário para Informações Gerais
        const responsibleOptions = teamMembers.map(member => `<option value="${member.id}" ${service.responsible === member.id ? 'selected' : ''}>${member.name}</option>`).join('');
        const categoryOptions = predefinedCategories.map(cat => `<option value="${cat.name}" ${service.category === cat.name ? 'selected' : ''}>${cat.name}</option>`).join('');

        generalInfoHtml = `
            <form id="inline-edit-general-form">
                <div class="form-group">
                    <label for="inline-edit-category">Categoria</label>
                    <select id="inline-edit-category" name="serviceCategory">${categoryOptions}</select>
                </div>
                <div class="form-group">
                    <label for="inline-edit-responsible">Responsável Geral</label>
                    <select id="inline-edit-responsible" name="responsibleName">${responsibleOptions}</select>
                </div>
                <div class="form-group">
                    <label for="inline-edit-priority">Prioridade</label>
                    <select id="inline-edit-priority" name="servicePriority">
                        <option value="Baixa" ${service.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                        <option value="Média" ${service.priority === 'Média' ? 'selected' : ''}>Média</option>
                        <option value="Alta" ${service.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="inline-edit-due-date">Data de Entrega</label>
                    <input type="date" id="inline-edit-due-date" name="serviceDueDate" value="${service.dueDate || ''}">
                </div>
            </form>
        `;

        // Formulário para Etapas (reutilizando a lógica do modal)
        stepsHtml = `
            <div id="inline-steps-container">
                ${service.steps.map(step => createStepGroupElement(step).outerHTML).join('')}
            </div>
            <button type="button" id="add-step-btn-inline" class="btn-secondary" style="margin-top: 15px;">+ Adicionar Etapa</button>
        `;

    } else {
        // MODO VISUALIZAÇÃO (Padrão)
        headerActionsHtml = `
            <button class="btn-primary btn-start-inline-edit" data-service-id="${service.id}">Editar</button>
            <a href="#/services" class="btn-secondary">Voltar</a>
        `;

        generalInfoHtml = `
            <p><strong>Categoria:</strong> ${service.category || "Não definida"}</p>
            <p><strong>Responsável Geral:</strong> ${responsibleName}</p>
            ${priorityDetailHtml}
            ${dueDateDetailHtml}
            <!-- MUDANÇA: Adiciona a barra de progresso -->
            <div class="progress-info">
                <span>Progresso</span>
                <span class="progress-text">${Math.round(progress.percentage)}%</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progress.percentage}%;"></div>
            </div>
        `;

        stepsHtml = service.steps.map((step, stepIndex) => {
            const stepProgress = calculateStepProgress(step);
            const stepProgressBarHtml = `
          <div class="step-progress-container">
              <div class="progress-info">
                  <span class="progress-text">${Math.round(stepProgress.percentage)}%</span>
              </div>
              <div class="progress-container">
                  <div class="progress-bar" style="width: ${stepProgress.percentage}%; background-color: ${step.color || 'var(--accent-color)'};"></div>
              </div>
          </div>`;

            const subtasksHtml = (step.subtasks || []).map((subtask, subtaskIndex) => {
                const subtaskPendingAlertHtml = hasPendingIssues(subtask) ?
              `<span class="alert-icon subtask-alert" title="${subtask.pendingDescription}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L1 21H23L12 2ZM13 8V14H11V8H13ZM13 16V18H11V16H13Z"/></svg>
              </span>` : '';
            
            // MUDANÇA: Coloca o ícone e a descrição da pendência dentro da mesma tag <p>.
            const pendingDescriptionHtml = hasPendingIssues(subtask) ?
              `<p class="pending-description-text">${subtaskPendingAlertHtml} ${subtask.pendingDescription}</p>` : '';

                return `
                <li class="step-item subtask-item">
                    <input type="checkbox" id="subtask-${
                      service.id
                    }-${stepIndex}-${subtaskIndex}" data-step-index="${stepIndex}" data-subtask-index="${subtaskIndex}" ${
              subtask.completed ? "checked" : ""
            }>
                    <label for="subtask-${service.id}-${stepIndex}-${subtaskIndex}">
                        ${subtask.name}
                    </label>
                    ${pendingDescriptionHtml}
                    <button class="btn-icon btn-delete-subtask-detail" title="Deletar Sub-etapa" data-step-index="${stepIndex}" data-subtask-index="${subtaskIndex}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                    </button>
                </li>
            `
            }).join("");

            const stepResponsibleName = step.responsibleId ? teamMemberMap.get(step.responsibleId) : "Ninguém";
            const stepResponsibleHtml = `<span class="step-assignee-detail">Responsável: ${stepResponsibleName}</span>`;

            const stepPendingAlertHtml = hasPendingIssuesInStep(step) ?
          `<span class="alert-icon step-alert" title="Esta etapa possui sub-etapas com pendências.">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L1 21H23L12 2ZM13 8V14H11V8H13ZM13 16V18H11V16H13Z"/></svg>
          </span>` : ''; // Este é o ícone que vamos controlar

            const startCollapsed = !openSteps.includes(stepIndex);

            return `
                <li class="step-group" data-step-name="${step.name}" data-step-index="${stepIndex}" style="--step-color: ${step.color || 'var(--progress-bar-bg)'};">
                    <h4 class="step-group-title ${
                      startCollapsed ? "collapsed" : ""
                    }"> 
                        <div class="step-title-content">
                            <span class="step-name-toggle">${step.name} ${stepPendingAlertHtml}</span>
                            ${stepResponsibleHtml}
                            ${stepProgressBarHtml}
                        </div>
                        <button class="btn-icon btn-delete-step-detail" title="Deletar Etapa" data-step-index="${stepIndex}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                        </button>
                    </h4>
                    <ul class="subtask-list ${
                      startCollapsed ? "hidden" : ""
                    }">${subtasksHtml}</ul>
                </li>`;
        }).join("");
    }
    
    const filesHtml = (service.files || []).map((file, index) => {
        // Se for um arquivo local, adiciona o atributo 'download'
        const downloadAttr = file.isLocal ? `download="${file.name}"` : "";
        return `
                <li class="file-item">
                    <a href="${file.url}" target="_blank" rel="noopener noreferrer" ${downloadAttr}>${file.name}</a>
                    <button class="btn-icon btn-delete-file" title="Deletar Arquivo" data-file-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                    </button>
                </li>
            `;
      })
      .join("");

    // MUDANÇA: Atualiza o conteúdo dos containers em vez de recriar tudo
    headerActionsContainer.innerHTML = headerActionsHtml;
    generalInfoContent.innerHTML = generalInfoHtml;
    stepsList.innerHTML = stepsHtml;
    fileList.innerHTML = filesHtml;

    // MUDANÇA: Atualiza o footer fixo
    stickyFooterContainer.innerHTML = isEditing ? `
        <div class="detail-sticky-footer">
            <button class="btn-primary btn-save-inline-edit" data-service-id="${service.id}">Salvar</button>
            <button class="btn-secondary btn-cancel-inline-edit">Cancelar</button>
        </div>` : '';

    // MUDANÇA: Inicializa o sortable para as etapas se estiver em modo de edição
    if (isEditing) {
        const stepsContainer = document.getElementById('inline-steps-container'); // Este é o container dentro do formulário
        if (stepsContainer) {
            new Sortable(stepsContainer, { animation: 150, handle: ".drag-handle", ghostClass: "sortable-ghost" });
        }
    }
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
                <a href="#/" class="btn-secondary">Voltar ao Dashboard</a>
            </div>
            <div class="detail-section">
                <h3>Informações da Conta</h3>
                <form id="profile-form">
                    <div class="form-group">
                        <label for="profile-name">Nome de Exibição</label>
                        <input type="text" id="profile-name" maxlength="30" value="${
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

  // --- MUDANÇA: Função para renderizar a página de gerenciamento de usuários (Admin) ---
  function renderUserManagementPage() {
    if (currentUser.role !== 'admin') {
        userManagementView.innerHTML = `<p>Acesso negado. Esta área é apenas para administradores.</p>`;
        return;
    }

    const usersHtml = allUsersData.map(user => `
        <li class="user-list-item" data-user-id="${user.id}">
            <div class="user-list-avatar">
                <img src="${user.photoURL || './assets/default-avatar.png'}" alt="Avatar de ${user.displayName}">
            </div>
            <div class="user-list-info">
                <div class="user-name">${user.displayName}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <div class="user-list-actions">
                <div class="form-group">
                    <select class="user-role-selector" ${user.id === currentUser.uid ? 'disabled' : ''}>
                        <option value="member" ${user.role === 'member' ? 'selected' : ''}>Membro</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    ${user.id === currentUser.uid ? '<small>Você não pode alterar seu próprio cargo.</small>' : ''}
                </div>
            </div>
        </li>
    `).join('');

    userManagementView.innerHTML = `
        <div class="detail-header">
            <h2>Gerenciamento de Usuários</h2>
            <a href="#/" class="btn-secondary">Voltar ao Dashboard</a>
        </div>
        <div class="detail-section">
            <h3>Membros da Equipe</h3>
            <ul class="user-list">
                ${usersHtml}
            </ul>
        </div>
    `;
  }

  // MUDANÇA: Função para renderizar a página de gerenciamento de categorias (Admin)
  function renderCategoryManagementPage() {
    if (currentUser.role !== 'admin') {
        categoryManagementView.innerHTML = `<p>Acesso negado. Esta área é apenas para administradores.</p>`;
        return;
    }

    const categoriesHtml = predefinedCategories.map(cat => `
        <li class="user-list-item" data-category-id="${cat.id}">
            <div class="category-color-swatch" style="background-color: ${cat.color || '#ccc'}"></div>
            <div class="user-list-info">
                <div class="user-name" style="color: ${cat.color || 'inherit'}">${cat.name}</div>
            </div>
            <div class="user-list-actions">
                <button class="btn-icon btn-edit-category" title="Editar Categoria">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65,21.1,6,20.71,5.63L18.37,3.29C18,2.9,17.35,2.9,16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg>
                </button>
                <button class="btn-icon btn-delete-category" title="Deletar Categoria">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                </button>
            </div>
        </li>
    `).join('');

    categoryManagementView.innerHTML = `
        <div class="detail-header">
            <h2>Gerenciamento de Categorias</h2>
            <a href="#/" class="btn-secondary">Voltar ao Dashboard</a>
        </div>
        <div class="detail-section">
            <h3>Adicionar Nova Categoria</h3>
            <form id="add-category-form" class="form-inline">
                <div class="form-group">
                    <input type="text" id="new-category-name" placeholder="Nome da Categoria" required>
                    <input type="color" id="new-category-color" title="Cor da Categoria" value="#001f3f">
                </div>
                <button type="submit" class="btn-primary">Adicionar</button>
            </form>
        </div>
        <div class="detail-section">
            <h3>Categorias Pré-definidas</h3>
            ${predefinedCategories.length > 0 ? `<ul class="user-list">${categoriesHtml}</ul>` : '<p>Nenhuma categoria pré-definida ainda.</p>'}
        </div>
    `;

    // Adiciona o listener para o formulário de adicionar categoria
    const addCategoryForm = document.getElementById('add-category-form');
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new-category-name');
            const categoryName = input.value.trim();
            const categoryColor = document.getElementById('new-category-color').value;

            if (!categoryName) return;

            showLoading();
            try {
                await addDoc(categoriesCollection, { name: categoryName, color: categoryColor });
                await loadPredefinedCategories(); // Recarrega a lista
                renderCategoryManagementPage(); // Redesenha a página
            } catch (error) {
                console.error("Erro ao adicionar categoria:", error);
                alert("Falha ao adicionar a categoria.");
            } finally {
                hideLoading();
            }
        });
    }
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
    const isDashboard = hash === "" || hash === "#/";
    const isServices = hash === "#/services"; // MUDANÇA: Verifica a correspondência exata para a lista
    const isServiceDetail = hash.startsWith("#/service/");
    const isProfile = hash.startsWith("#/profile");
    const isRequests = hash.startsWith("#/requests");
    const isUserManagement = hash.startsWith("#/users");
    const isCategoryManagement = hash.startsWith("#/categories");

    // MUDANÇA: Limpa o listener de comentários se não estiver na página de detalhes
    if (!isServiceDetail && unsubscribeFromComments) { 
      unsubscribeFromComments();
      unsubscribeFromComments = null;
    }

    // Esconde/mostra os containers corretos
    dashboardView.classList.toggle("hidden", !isDashboard);
    serviceContainer.classList.toggle("hidden", !isServices);
    taskDetailView.classList.toggle("hidden", !isServiceDetail);
    profileView.classList.toggle("hidden", !isProfile);
    requestsView.classList.toggle("hidden", !isRequests);
    userManagementView.classList.toggle("hidden", !isUserManagement);
    categoryManagementView.classList.toggle("hidden", !isCategoryManagement);

    // Adiciona uma classe ao body para estilizar o header de forma diferente
    const isSubPage = isServiceDetail || isProfile || isRequests || isServices || isUserManagement || isCategoryManagement;
    document.body.classList.toggle("detail-view-active", isSubPage);

    // Carrega o conteúdo da view ativa
    if (isServiceDetail) {
      const taskId = hash.substring("#/service/".length);
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

        renderServiceDetail(service, openStepsIndices);
        listenForComments(taskId); // MUDANÇA: Começa a ouvir os comentários da tarefa
        initializeDetailStepSorting(taskId); // MUDANÇA: Ativa o drag-and-drop na página de detalhes
      } else {
        // Se a tarefa não for encontrada, volta para a lista principal
        console.warn(`Serviço com ID ${taskId} não encontrado.`);
        window.location.hash = "#/services";
      }
    } else if (isDashboard) {
      // Nenhuma ação necessária, o HTML é estático
    } else if (isProfile) {
      renderProfilePage();
    } else if (isRequests) {
      renderRequestsPage();
    } else if (isUserManagement) {
      renderUserManagementPage();
    } else if (isCategoryManagement) {
      renderCategoryManagementPage();
    } else if (isServices) {
      // A view padrão é a lista de serviços
      // MUDANÇA: Renderiza a estrutura da página e depois os cards
      serviceContainer.innerHTML = `
        <div class="detail-header requests-header">
            <h2>Gerenciar Serviços</h2>
            <button id="add-service-btn" class="btn-primary">+ Adicionar Serviço</button>
            <a href="#/" class="btn-secondary">Voltar ao Dashboard</a>
        </div>
        <div class="search-bar-wrapper">
            <input type="search" id="services-search-input" placeholder="Pesquisar por nome, responsável, categoria...">
        </div>
        <div id="service-list-wrapper"></div>
      `;
      // Adiciona o listener para a nova barra de pesquisa
      const searchInput = document.getElementById('services-search-input');
      searchInput.addEventListener('input', renderServiceCards);
      // MUDANÇA: Limpa o wrapper antes de renderizar para evitar duplicação de conteúdo
      const wrapper = document.getElementById("service-list-wrapper");
      if (wrapper) wrapper.innerHTML = '';
      renderServiceCards(); // Renderiza os cards iniciais
    }
  }

  // --- MUDANÇA: Gerenciador de eventos centralizado (Event Delegation) ---
  // Ouve cliques em todo o documento para lidar com elementos criados dinamicamente
  document.addEventListener("click", async (e) => {
    // Botão "Voltar para a lista" nas páginas de detalhe/perfil
    // MUDANÇA: Botões de ação que foram movidos
    if (e.target.id === 'add-service-btn') {
        openAddServiceModal();
    }

    if (e.target.id === 'make-request-btn') {
        openMakeRequestModal();
    }


    if (e.target.matches(".detail-header a.btn-secondary")) {
      e.preventDefault();
      window.location.hash = e.target.getAttribute("href"); // Navega para o href do botão
    }

    // Título de um grupo de etapas (para expandir/recolher)
    // MUDANÇA: Agora o clique pode ser em toda a área do título da etapa.
    const stepGroupTitle = e.target.closest(".step-group-title");
    if (stepGroupTitle && !e.target.closest('button')) { // Ignora cliques nos botões dentro do título
        stepGroupTitle.classList.toggle("collapsed");
        const subtaskList = stepGroupTitle.nextElementSibling;
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

    // MUDANÇA: Lógica para o botão "Reabrir Serviço"
    const reopenBtn = e.target.closest(".btn-reopen");
    if (reopenBtn) {
        const serviceId = reopenBtn.dataset.serviceId;
        const service = services.find(s => s.id === serviceId);

        if (service && confirm("Tem certeza que deseja reabrir este serviço? Ele voltará para sua categoria original.")) {
            showLoading();
            try {
                // Encontra a primeira sub-etapa e a desmarca
                const firstStepWithSubtasks = service.steps.find(step => step.subtasks && step.subtasks.length > 0);
                if (firstStepWithSubtasks) {
                    firstStepWithSubtasks.subtasks[0].completed = false;
                    const serviceRef = doc(db, "services", serviceId);
                    await updateDoc(serviceRef, { steps: service.steps });
                    // O onSnapshot cuidará de mover o card
                }
            } catch (error) {
                console.error("Erro ao reabrir serviço:", error);
                alert("Falha ao reabrir o serviço.");
            } finally {
                hideLoading();
            }
        }
    }

    // MUDANÇA: Abrir/fechar painel de notificações
    if (e.target.closest("#notification-bell")) {
        const panel = document.getElementById("notification-panel");
        panel.classList.toggle("hidden");

        // CORREÇÃO: Marca as notificações como lidas quando o painel é aberto.
        // A verificação `!panel.classList.contains("hidden")` garante que isso só aconteça
        // quando o painel está visível (ou seja, após o toggle o ter aberto).
        if (!panel.classList.contains("hidden")) {
            // Fornece feedback visual imediato zerando o contador
            notificationCount.textContent = '0';
            notificationCount.classList.add("hidden");
            markNotificationsAsRead();
        }
    } else if (!e.target.closest("#notification-panel")) {
        // Fecha o painel se clicar fora dele
        document.getElementById("notification-panel").classList.add("hidden");
    }

    // MUDANÇA: Botão de editar categoria
    const editCategoryBtn = e.target.closest(".btn-edit-category");
    if (editCategoryBtn) {
        const listItem = editCategoryBtn.closest(".user-list-item");
        const categoryId = listItem.dataset.categoryId;
        const category = predefinedCategories.find(c => c.id === categoryId);
        if (!category) return;

        // Salva o HTML original para poder cancelar a edição
        listItem.dataset.originalHtml = listItem.innerHTML;

        // Transforma o item da lista em um formulário de edição
        listItem.innerHTML = `
            <div class="category-edit-form">
                <input type="color" name="editCategoryColor" value="${category.color || '#001f3f'}">
                <input type="text" name="editCategoryName" value="${category.name}" required>
                <div class="user-list-actions">
                    <button class="btn-icon btn-save-category" title="Salvar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>
                    </button>
                    <button class="btn-icon btn-cancel-edit-category" title="Cancelar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
                    </button>
                </div>
            </div>
        `;
        listItem.classList.add('editing');
    }

    // MUDANÇA: Botão para cancelar a edição da categoria
    const cancelEditCategoryBtn = e.target.closest(".btn-cancel-edit-category");
    if (cancelEditCategoryBtn) {
        const listItem = cancelEditCategoryBtn.closest(".user-list-item");
        listItem.innerHTML = listItem.dataset.originalHtml;
        listItem.classList.remove('editing');
        delete listItem.dataset.originalHtml;
    }

    // MUDANÇA: Botão para salvar a edição da categoria
    const saveCategoryBtn = e.target.closest(".btn-save-category");
    if (saveCategoryBtn) {
        const listItem = saveCategoryBtn.closest(".user-list-item");
        const categoryId = listItem.dataset.categoryId;
        const newName = listItem.querySelector('[name="editCategoryName"]').value.trim();
        const newColor = listItem.querySelector('[name="editCategoryColor"]').value;

        if (!newName || !categoryId) return;

        showLoading();
        try {
            const categoryRef = doc(db, "categories", categoryId);
            await updateDoc(categoryRef, { name: newName, color: newColor });
            await loadPredefinedCategories(); // Recarrega os dados
            renderCategoryManagementPage(); // Redesenha a página com os dados atualizados
        } catch (error) {
            console.error("Erro ao atualizar categoria:", error);
            alert("Falha ao atualizar a categoria.");
        } finally {
            hideLoading();
        }
    }

    // MUDANÇA: Botão de deletar categoria
    const deleteCategoryBtn = e.target.closest(".btn-delete-category");
    if (deleteCategoryBtn) {
        const categoryId = deleteCategoryBtn.closest(".user-list-item").dataset.categoryId;
        if (confirm("Tem certeza que deseja deletar esta categoria pré-definida?")) {
            showLoading();
            try {
                await deleteDoc(doc(db, "categories", categoryId));
                await loadPredefinedCategories(); // Recarrega a lista
                renderCategoryManagementPage(); // Redesenha a página
            } catch (error) {
                console.error("Erro ao deletar categoria:", error);
                alert("Falha ao deletar a categoria.");
            } finally {
                hideLoading();
            }
        }
    }

    // MUDANÇA: Botão para iniciar a edição inline na página de detalhes
    const startInlineEditBtn = e.target.closest(".btn-start-inline-edit");
    if (startInlineEditBtn) {
        const serviceId = startInlineEditBtn.dataset.serviceId;
        const service = services.find(s => s.id === serviceId);
        if (service) {
            renderServiceDetail(service, [], true); // Renderiza em modo de edição
        }
    }

    // MUDANÇA: Botão para cancelar a edição inline
    const cancelInlineEditBtn = e.target.closest(".btn-cancel-inline-edit");
    if (cancelInlineEditBtn) {
        const serviceId = window.location.hash.substring("#/service/".length);
        const service = services.find(s => s.id === serviceId);
        if (service) {
            renderServiceDetail(service, [], false); // Renderiza em modo de visualização
        }
    }

    // MUDANÇA: Botão para salvar a edição inline
    const saveInlineEditBtn = e.target.closest(".btn-save-inline-edit");
    if (saveInlineEditBtn) {
        const serviceId = saveInlineEditBtn.dataset.serviceId;
        
        // CORREÇÃO: Busca o formulário dentro da view de detalhes
        const generalForm = taskDetailView.querySelector('#inline-edit-general-form');
        const category = generalForm.querySelector('[name="serviceCategory"]').value;
        const responsible = generalForm.querySelector('[name="responsibleName"]').value;
        const priority = generalForm.querySelector('[name="servicePriority"]').value;
        const dueDate = generalForm.querySelector('[name="serviceDueDate"]').value;

        // CORREÇÃO: Busca os grupos de etapas dentro da view de detalhes
        const serviceToUpdate = services.find(s => s.id === serviceId);
        // CORREÇÃO: Passa o serviço original para a função collectStepsFromForm para preservar o status 'completed'.
        const stepGroups = taskDetailView.querySelectorAll('#inline-steps-container .step-group-modal');
        const steps = collectStepsFromForm(stepGroups, serviceToUpdate);

        if (serviceToUpdate) {
            showLoading();
            try {
                const serviceRef = doc(db, "services", serviceId);
                await updateDoc(serviceRef, { category, responsible, priority, dueDate, steps });
                alert("Serviço atualizado com sucesso!");
                // CORREÇÃO: Redesenha a página no modo de visualização após salvar.
                renderServiceDetail(serviceToUpdate, [], false);
            } catch (error) {
                console.error("Erro ao salvar serviço:", error);
                alert("Falha ao salvar as alterações.");
            } finally {
                hideLoading();
            }
        }
    }

    // MUDANÇA: Botão de deletar arquivo na página de detalhes
    const deleteFileBtn = e.target.closest(".btn-delete-file");
    if (deleteFileBtn) {
      const fileIndex = parseInt(deleteFileBtn.dataset.fileIndex, 10);
      const serviceId = window.location.hash.substring("#/service/".length);
      const service = services.find(s => s.id === serviceId);

      if (service && confirm("Tem certeza que deseja deletar este arquivo?")) {
        showLoading();
        try {
          const updatedFiles = service.files.filter((_, index) => index !== fileIndex);
          const serviceRef = doc(db, "services", serviceId);
          await updateDoc(serviceRef, { files: updatedFiles });
          // A UI se atualizará pelo onSnapshot
        } catch (error) {
          console.error("Erro ao deletar arquivo:", error);
          alert("Falha ao deletar o arquivo.");
        } finally {
          hideLoading();
        }
      }
    }

    // MUDANÇA: Botão de deletar sub-etapa na página de detalhes
    const deleteSubtaskDetailBtn = e.target.closest(".btn-delete-subtask-detail");
    if (deleteSubtaskDetailBtn) {
        const stepIndex = parseInt(deleteSubtaskDetailBtn.dataset.stepIndex, 10);
        const subtaskIndex = parseInt(deleteSubtaskDetailBtn.dataset.subtaskIndex, 10);
        const serviceId = window.location.hash.substring("#/service/".length);
        const service = services.find(s => s.id === serviceId);

        if (service && confirm("Tem certeza que deseja deletar esta sub-etapa?")) {
            showLoading();
            try {
                service.steps[stepIndex].subtasks.splice(subtaskIndex, 1);
                const serviceRef = doc(db, "services", serviceId);
                await updateDoc(serviceRef, { steps: service.steps });
            } catch (error) {
                console.error("Erro ao deletar sub-etapa:", error);
                alert("Falha ao deletar a sub-etapa.");
            } finally {
                hideLoading();
            }
        }
    }

    // MUDANÇA: Botão de deletar etapa na página de detalhes
    const deleteStepDetailBtn = e.target.closest(".btn-delete-step-detail");
    if (deleteStepDetailBtn) {
        const stepIndex = parseInt(deleteStepDetailBtn.dataset.stepIndex, 10);
        const serviceId = window.location.hash.substring("#/service/".length);
        const service = services.find(s => s.id === serviceId);

        if (service && confirm("Tem certeza que deseja deletar esta etapa e todas as suas sub-etapas?")) {
            showLoading();
            try {
                service.steps.splice(stepIndex, 1);
                const serviceRef = doc(db, "services", serviceId);
                await updateDoc(serviceRef, { steps: service.steps });
            } catch (error) {
                console.error("Erro ao deletar etapa:", error);
                alert("Falha ao deletar a etapa.");
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
            // MUDANÇA: Verifica se a edição é a partir do card ou da página de detalhes
            const isOnDetailPage = editBtn.closest('#task-detail-view');
            if (isOnDetailPage) {
                // Inicia a edição inline
                renderServiceDetail(serviceToEdit, [], true);
            } else {
                // Abre o modal (comportamento antigo)
                openEditModal(serviceToEdit);
            }
        }
    }

    // MUDANÇA: Botão de remover etapa no modal de adicionar serviço
    const deleteStepBtn = e.target.closest(".btn-delete-step");
    if (deleteStepBtn) {
      // CORREÇÃO: Garante que todo o grupo da etapa seja removido, não apenas a linha do nome.
      deleteStepBtn.closest(".step-group-modal").remove();
    }

    // MUDANÇA: Botão de adicionar sub-etapa no modal
    const addSubstepBtn = e.target.closest(".btn-add-substep");
    if (addSubstepBtn) {
      const substepsContainer =
        addSubstepBtn.previousElementSibling;
      substepsContainer.appendChild(createSubstepInputRow());
    }

    // MUDANÇA: Botão de adicionar sub-etapa na edição inline
    const addSubstepBtnInline = e.target.closest(".btn-add-substep-inline");
    if (addSubstepBtnInline) {
        const substepsContainer = addSubstepBtnInline.previousElementSibling;
        substepsContainer.appendChild(createSubstepInputRow());
    }

    // MUDANÇA: Botão de remover sub-etapa no modal
    const deleteSubstepBtn = e.target.closest(".btn-delete-substep");
    if (deleteSubstepBtn) {
      deleteSubstepBtn.parentElement.remove();
    }

    // MUDANÇA: Botão de adicionar etapa na edição inline
    const addStepBtnInline = e.target.closest("#add-step-btn-inline");
    if (addStepBtnInline) {
        const container = document.getElementById('inline-steps-container');
        container.appendChild(createStepGroupElement());
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
          window.location.hash = "#/services"; // Navega para a lista de serviços
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
      try {
        const requestRef = doc(db, "requests", requestId);
        await updateDoc(requestRef, { status: "rejected" });
        // O onSnapshot cuidará de redesenhar a UI
      } catch (error) {
        console.error("Erro ao rejeitar solicitação:", error);
        alert("Falha ao rejeitar a solicitação.");
      } finally {
        hideLoading();
      }
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
      const taskId = window.location.hash.substring("#/service/".length);

      const service = services.find((s) => s.id === taskId); // CORREÇÃO: A variável já estava correta, mas o problema estava em outro lugar.
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

      // CORREÇÃO: Captura o ID do serviço a partir do hash da URL corretamente.
      const taskId = window.location.hash.split('/')[2];
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

    // MUDANÇA: Lógica para alterar o cargo de um usuário (movido para o evento 'change')
    if (e.target.classList.contains('user-role-selector')) {
        const select = e.target;
        const newRole = select.value;
        const userId = select.closest('.user-list-item').dataset.userId;

        if (!userId || userId === currentUser.uid) return;

        showLoading();
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { role: newRole });
            alert('Cargo do usuário atualizado com sucesso!');
            // Atualiza o estado local para consistência imediata da UI
            const userToUpdate = allUsersData.find(u => u.id === userId);
            if (userToUpdate) userToUpdate.role = newRole;
        } catch (error) {
            console.error("Erro ao atualizar cargo:", error);
            alert('Falha ao atualizar o cargo do usuário.');
            // Reverte a mudança na UI em caso de erro
            const userToUpdate = allUsersData.find(u => u.id === userId);
            if (userToUpdate) select.value = userToUpdate.role;
        } finally {
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

      const taskId = window.location.hash.substring("#/service/".length);
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
      const nameInput = e.target.querySelector("#file-name-input");
      const urlInput = e.target.querySelector("#file-url-input");
      const fileName = nameInput.value.trim();
      const url = urlInput.value.trim();
      if (!url || !fileName) return;

      const taskId = window.location.hash.substring("#/service/".length);

      const fileData = { name: fileName, url: url, isLocal: false };
      showLoading();
      await addFileToService(taskId, fileData);
      hideLoading();
      nameInput.value = "";
      urlInput.value = "";
    }

    // Formulário de Perfil
    if (e.target.id === "profile-form") {
      e.preventDefault();
      const newName = document.getElementById("profile-name").value;

      // MUDANÇA: Validação do tamanho do nome
      if (newName.length > 30) {
          alert("O nome de exibição não pode ter mais de 30 caracteres.");
          return;
      }

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

  // MUDANÇA: Lógica para o botão "Continuar como"
  continueAsBtn.addEventListener("click", () => {
      if (currentUser) {
          // O usuário já está autenticado, apenas procedemos para o app
          initializeAppUI(currentUser);
      }
  });

  // MUDANÇA: Lógica para "Entrar com outra conta"
  switchAccountLink.addEventListener("click", (e) => {
      e.preventDefault();
      signOut(auth); // Desloga o usuário atual para mostrar a tela de login padrão
  });

  // --- LÓGICA PRINCIPAL DE AUTENTICAÇÃO E EVENTOS ---

  onAuthStateChanged(auth, async (user) => {
    // Esta função é chamada sempre que o estado de login do usuário muda.
    if (user) {
      // Garante que o perfil do usuário no Firestore está atualizado com nome, email, etc.
      await updateUserInFirestore(user);

      // MUDANÇA: Busca o perfil completo para ter os dados mais recentes
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
          currentUser = { ...user, ...userDocSnap.data() };
      } else {
          currentUser = user;
      }

      // MUDANÇA: Em vez de logar direto, mostra a tela "Continuar como"
      showContinueAsScreen(currentUser);
    } else {
      // --- O USUÁRIO ESTÁ DESLOGADO ---
      currentUser = null;
      console.log("Nenhum usuário logado.");

      // Se houver um listener de serviços ativo, remove-o para evitar erros
      if (unsubscribeFromServices) {
        unsubscribeFromServices();
        window.removeEventListener("hashchange", handleRouteChange); // MUDANÇA: Remove o listener
        unsubscribeFromServices = null;
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
      // MUDANÇA: Desliga o listener de notificações
      if (unsubscribeFromNotifications) {
        unsubscribeFromNotifications();
        unsubscribeFromNotifications = null;
      }

      // Limpa os dados locais da aplicação
      services = [];
      teamMembers = [];
      teamMemberMap.clear();

      // Atualiza a UI para o estado "deslogado", mostrando a tela de login
      loginContainer.classList.remove("hidden");
      appHeader.classList.add("hidden");
      // CORREÇÃO: Garante que a caixa de login principal seja exibida.
      loginBox.classList.remove("hidden");
      registerBox.classList.add("hidden");
      continueAsBox.classList.add("hidden"); // Garante que a tela "Continuar como" esteja oculta
      userProfile.classList.add("hidden");
      serviceContainer.classList.add("hidden");
      taskDetailView.classList.add("hidden");
      profileView.classList.add("hidden");
      dashboardView.classList.add("hidden");
      requestsView.classList.add("hidden");
      categoryManagementView.classList.add("hidden");
      notificationContainer.classList.add("hidden");
      userManagementView.classList.add("hidden");

      // Garante que o layout volte ao normal
      document.body.classList.remove("detail-view-active");
    }
  });

  // MUDANÇA: Nova função para mostrar a tela "Continuar como"
  function showContinueAsScreen(user) {
      const photoEl = document.getElementById('continue-as-photo');
      const nameEl = document.getElementById('continue-as-name');

      photoEl.src = user.photoURL || "./assets/default-avatar.png";
      nameEl.textContent = user.displayName || user.email;

      loginBox.classList.add("hidden");
      registerBox.classList.add("hidden");
      continueAsBox.classList.remove("hidden");
  }

  // MUDANÇA: Nova função para inicializar a UI após o login confirmado
  async function initializeAppUI(user) {
      // --- O USUÁRIO ESTÁ LOGADO ---
      console.log("Usuário logado:", user.uid);

      // Carrega a lista de membros da equipe para usar na aplicação
      await loadTeamMembers();

      // Carrega as categorias pré-definidas
      await loadPredefinedCategories();

      // Atualiza a UI para o estado "logado"
      userNameEl.textContent = user.displayName || user.email;
      userPhotoEl.src = user.photoURL || "./assets/default-avatar.png";

      // Mostra o card de gerenciamento de usuários se for admin
      const adminCard = document.getElementById('admin-user-management-card');
      const adminCategoryCard = document.getElementById('admin-category-management-card');
      if (user.role === 'admin') {
          adminCard.classList.remove('hidden');
          adminCategoryCard.classList.remove('hidden');
      } else {
          adminCard.classList.add('hidden');
          adminCategoryCard.classList.add('hidden');
      }

      loginContainer.classList.add("hidden");
      appHeader.classList.remove("hidden");
      userProfile.classList.remove("hidden");
      dashboardView.classList.remove("hidden");

      // Começa a ouvir por atualizações nos serviços do usuário em tempo real
      listenForServices(user);

      // Começa a ouvir as solicitações para atualizar o selo do dashboard
      listenForRequests();

      // Começa a ouvir por notificações
      listenForNotifications(user.uid);

      // Verifica a URL para mostrar a view correta
      handleRouteChange();
      window.addEventListener("hashchange", handleRouteChange);
  }
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
      showLoading(); // Mostra o carregamento
      await signInWithPopup(auth, provider);
      // O onAuthStateChanged cuidará de atualizar a UI.
      // O hideLoading() será chamado dentro do onAuthStateChanged após a UI ser montada.
    } catch (error) {
      hideLoading(); // Esconde o carregamento em caso de erro
      console.error("Erro no login com Google:", error);
      // MUDANÇA: Mensagem de erro mais específica
      if (error.code === 'auth/operation-not-allowed') {
          loginErrorEl.textContent = "Login com Google não está habilitado no Firebase. Verifique as configurações.";
      } else if (error.code === 'auth/unauthorized-domain') {
          loginErrorEl.textContent = "Este domínio não está autorizado para login. Use um servidor local (Live Server).";
      } else if (error.code === 'auth/popup-closed-by-user') {
          loginErrorEl.textContent = "A janela de login foi fechada antes da conclusão.";
      } else {
          loginErrorEl.textContent = "Falha ao autenticar com o Google.";
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

    // MUDANÇA: Validação do tamanho do nome
    if (name.length > 30) {
        registerErrorEl.textContent = "O nome de usuário não pode ter mais de 30 caracteres.";
        registerErrorEl.classList.remove("hidden");
        hideLoading();
        return;
    }

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

  // Evento para o link "Esqueci minha senha"
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = emailLoginForm["login-email"].value;
    loginErrorEl.classList.add("hidden");

    if (!email) {
      alert("Por favor, digite seu e-mail no campo correspondente antes de solicitar a redefinição de senha.");
      return;
    }

    showLoading();
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Um e-mail para redefinição de senha foi enviado para ${email}. Verifique sua caixa de entrada e spam.`);
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      loginErrorEl.textContent = "Não foi possível enviar o e-mail. Verifique se o e-mail está correto e tente novamente.";
      if (error.code === 'auth/user-not-found') {
        loginErrorEl.textContent = "Nenhum usuário encontrado com este e-mail.";
      }
      loginErrorEl.classList.remove("hidden");
    } finally {
      hideLoading(); // Garante que o carregamento seja escondido, com sucesso ou erro.
    }
  });
  // --- MUDANÇA: LÓGICA DOS MODAIS ---

  // MUDANÇA: Nova função para popular as sugestões de categoria
  function populateCategorySuggestions() {
    const select = document.getElementById("service-category");
    if (!select) return;

    // MUDANÇA: Popula o <select> apenas com as categorias pré-definidas pelo admin.
    const optionsHtml = predefinedCategories
      .map(cat => `<option value="${cat.name}">${cat.name}</option>`)
      .join('');
    select.innerHTML = `<option value="">Selecione uma categoria...</option>${optionsHtml}`;
  }

  // MUDANÇA: Nova função para inicializar a ordenação dos cartões de serviço
  function initializeServiceCardSorting() {
    const containers = document.querySelectorAll('.service-card-grid');
    containers.forEach(container => {
      new Sortable(container, {
        group: 'services', // Permite arrastar entre categorias
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
          const serviceId = evt.item.dataset.id;
          const newCategory = evt.to.dataset.category;
          
          // Pega todos os IDs na nova lista e encontra o novo índice
          const serviceIdsInNewList = Array.from(evt.to.children).map(card => card.dataset.id);
          const newIndex = serviceIdsInNewList.indexOf(serviceId);

          // Atualiza o serviço no Firestore
          const serviceRef = doc(db, "services", serviceId);
          await updateDoc(serviceRef, { category: newCategory, orderIndex: newIndex });
          // O onSnapshot irá redesenhar a UI, mas a mudança visual é instantânea.
        }
      });
    });
  }

  // MUDANÇA: Função para salvar a nova ordem das etapas
  async function saveStepOrder(serviceId, newStepOrder) {
      const service = services.find(s => s.id === serviceId);
      if (!service) return;

      // Mapeia a nova ordem de nomes de volta para a estrutura completa das etapas
      const originalStepsMap = new Map(service.steps.map(step => [step.name, step]));
      const reorderedSteps = newStepOrder.map(stepName => originalStepsMap.get(stepName));

      // Atualiza o objeto local e o Firestore
      service.steps = reorderedSteps;
      const serviceRef = doc(db, "services", serviceId);
      try {
          await updateDoc(serviceRef, { steps: reorderedSteps });
      } catch (error) {
          console.error("Erro ao reordenar etapas:", error);
          alert("Falha ao salvar a nova ordem das etapas.");
      }
  }

  // MUDANÇA: Função para inicializar a ordenação das etapas no cartão
  function initializeCardStepSorting(listId, serviceId) {
      const listElement = document.getElementById(listId);
      if (listElement && !listElement.classList.contains('sortable-initialized')) {
          new Sortable(listElement, {
              animation: 150,
              ghostClass: "sortable-ghost",
              onEnd: (evt) => {
                  const newOrder = Array.from(evt.target.children).map(item => item.dataset.stepName);
                  saveStepOrder(serviceId, newOrder);
              },
          });
          listElement.classList.add('sortable-initialized');
      }
  }

  // MUDANÇA: Função para inicializar a ordenação na página de detalhes
  function initializeDetailStepSorting(serviceId) {
      const listElement = document.getElementById('detailed-steps-list');
      if (listElement) {
          new Sortable(listElement, {
              animation: 150,
              handle: ".step-group-title", // Permite arrastar pelo título
              ghostClass: "sortable-ghost",
              onEnd: (evt) => {
                  const newOrder = Array.from(evt.target.children).map(item => item.dataset.stepName);
                  // Salva a nova ordem
                  saveStepOrder(serviceId, newOrder).then(() => {
                      // Redesenha a view para atualizar os índices, se necessário
                      const service = services.find(s => s.id === serviceId);
                      if (service) renderServiceDetail(service);
                  });
              },
          });
      }
  }

  // MUDANÇA: Nova função para inicializar a ordenação das etapas
  function initializeStepSorting() {
    if (sortableSteps) {
      sortableSteps.destroy();
    }
    sortableSteps = new Sortable(stepsContainer, {
      animation: 150,
      handle: ".drag-handle", // Define o ícone como a alça para arrastar
      ghostClass: "sortable-ghost", // Classe CSS para o item "fantasma"
      dragClass: "sortable-drag", // Classe CSS para o item sendo arrastado
    });
  }

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
    populateCategorySuggestions(); // MUDANÇA: Popula as categorias

    // Preenche o formulário com os dados do serviço
    addServiceForm.querySelector('[name="serviceName"]').value = service.name;
    addServiceForm.querySelector('[name="responsibleName"]').value =
      service.responsible;
    addServiceForm.querySelector('[name="serviceCategory"]').value =
      service.category || "";
    // MUDANÇA: Preenche a data de entrega
    addServiceForm.querySelector('[name="serviceDueDate"]').value = service.dueDate || "";
    // MUDANÇA: Preenche a prioridade
    addServiceForm.querySelector('[name="servicePriority"]').value = service.priority || "Média";

    // MUDANÇA: Limpa e preenche as etapas e sub-etapas corretamente
    stepsContainer.innerHTML = "";
    service.steps.forEach((step) => {
      stepsContainer.appendChild(createStepGroupElement(step));
    });

    // Altera o título e o botão do modal
    modal.querySelector("h2").textContent = "Editar Serviço";
    modal.querySelector('.modal-footer button[type="submit"]').textContent =
      "Salvar Alterações";

    modal.style.display = "block";
    initializeStepSorting(); // MUDANÇA: Ativa o arrastar e soltar
  }

  function openAddServiceModal() {
    addServiceForm.reset(); // Limpa o formulário
    // MUDANÇA: Limpa o container e adiciona o primeiro grupo de etapa/sub-etapa
    stepsContainer.innerHTML = "";
    stepsContainer.appendChild(createStepGroupElement());
    populateTeamMemberSelects();
    populateCategorySuggestions(); // MUDANÇA: Popula as categorias

    // MUDANÇA: Garante que o modal esteja em modo de "adição"
    currentEditServiceId = null; // Reset currentEditServiceId for new service
    modal.querySelector("h2").textContent = "Adicionar Novo Serviço";
    modal.querySelector('.modal-footer button[type="submit"]').textContent = "Criar Serviço"; // Target the button in the footer

    modal.style.display = "block";
  }

  function openMakeRequestModal() {
    makeRequestForm.reset();
    const mentionSelect = document.getElementById("request-mention");
    if (mentionSelect) {
      const optionsHtml = teamMembers
        .map(member => `<option value="${member.id}">${member.name}</option>`)
        .join("");
      mentionSelect.innerHTML = `<option value="">Ninguém em específico</option>${optionsHtml}`;
    }
    makeRequestModal.style.display = "block";
  }

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
    const dueDate = formData.get("serviceDueDate"); // MUDANÇA: Pega a data
    const priority = formData.get("servicePriority"); // MUDANÇA: Pega a prioridade

    // MUDANÇA: Lógica para coletar etapas e sub-etapas
    const stepGroups = stepsContainer.querySelectorAll(".step-group-modal");    
    const steps = collectStepsFromForm(stepGroups, currentEditServiceId ? services.find(s => s.id === currentEditServiceId) : null);

    const serviceData = {
      name: serviceName,
      responsible: responsibleId,
      category: category,
      orderIndex: services.length, // MUDANÇA: Define uma ordem inicial
      priority: priority, // MUDANÇA: Salva a prioridade
      dueDate: dueDate || null, // MUDANÇA: Salva a data ou null
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
      addServiceForm.reset();
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
    const mentionedUserId = makeRequestForm["request-mention"].value;

    showLoading();
    try {
      await addDoc(requestsCollection, {
        title,
        description,
        mentionedUserId: mentionedUserId || null, // Salva o ID ou null
        mentionedUserName: mentionedUserId ? teamMemberMap.get(mentionedUserId) : null, // Salva o nome para referência
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName || currentUser.email,
        requesterPhotoURL: currentUser.photoURL || './assets/default-avatar.png',
        status: "pending", // 'pending', 'approved', 'rejected'
        createdAt: serverTimestamp(),
      });
      makeRequestModal.style.display = "none";

      // MUDANÇA: Cria a notificação se um usuário foi mencionado
      if (mentionedUserId) {
          await addDoc(notificationsCollection, {
              userId: mentionedUserId,
              text: `Você foi mencionado na solicitação "${title}" por ${currentUser.displayName}.`,
              link: "#/requests",
              read: false,
              createdAt: serverTimestamp(),
          });

          // MUDANÇA: Adiciona um documento na coleção 'mail' para disparar o e-mail.
          // A extensão "Send Email" irá processar este documento.
          const mentionedUserEmail = allUsersData.find(u => u.id === mentionedUserId)?.email;
          if (mentionedUserEmail) {
              await addDoc(collection(db, "mail"), {
                  to: mentionedUserEmail,
                  message: {
                      subject: `[Painel de Gestão] Você foi mencionado em uma solicitação!`,
                      html: `Olá, ${mentionedUserName}!<br><br>
                             O usuário <strong>${currentUser.displayName}</strong> mencionou você na solicitação: <strong>"${title}"</strong>.<br><br>
                             Acesse o painel para ver os detalhes.`,
                  },
              });
          }
      }

      alert("Solicitação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      alert("Falha ao enviar a solicitação.");
    } finally {
      hideLoading();
    }
  });

  // MUDANÇA: Função movida para o escopo global para ser reutilizável.
  // Coleta dados das etapas de um formulário (modal ou inline) e preserva o estado 'completed'.
  function collectStepsFromForm(stepGroups, originalService = null) {
      return Array.from(stepGroups).map((group, stepIndex) => {
          const stepName = group.querySelector('[name="stepName"]').value;
          const stepColor = group.querySelector('[name="stepColor"]').value;
          const stepResponsibleId = group.querySelector('[name="stepResponsible"]').value;
          const substepInputs = group.querySelectorAll('[name="substepName"]');

          const subtasks = Array.from(substepInputs).map((input, subtaskIndex) => {
              // --- LÓGICA DE MESCLAGEM CORRIGIDA ---
              const subtaskId = input.dataset.id;
              const newName = input.value.trim();              const newPendingDescription = group.querySelector(`select[data-id="${subtaskId}"]`)?.value.trim() || '';

              // Tenta encontrar a sub-etapa original pelo índice. Isso é seguro porque a ordem não muda durante a edição.
              const originalSubtask = originalService?.steps[stepIndex]?.subtasks[subtaskIndex];

              // Preserva o status 'completed' da sub-etapa original, se ela existir.
              const isCompleted = originalSubtask ? originalSubtask.completed : false;

              return {
                  name: newName,
                  completed: isCompleted,
                  pendingDescription: newPendingDescription,
              };
          });

          return { name: stepName, color: stepColor, responsibleId: stepResponsibleId || null, subtasks };
      });
  }

  // --- MUDANÇA: Funções para o sistema de notificação ---
  function listenForNotifications(userId) {
      notificationContainer.classList.remove("hidden");

      if (unsubscribeFromNotifications) {
          unsubscribeFromNotifications();
      }

      const q = query(
          notificationsCollection,
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
      );

      unsubscribeFromNotifications = onSnapshot(q, (snapshot) => {
          const unreadCount = snapshot.docs.filter(doc => !doc.data().read).length;
          const notificationList = document.getElementById("notification-list");

          // Atualiza o contador no sino
          if (unreadCount > 0) {
              notificationCount.textContent = unreadCount;
              notificationCount.classList.remove("hidden");
          } else {
              notificationCount.classList.add("hidden");
          }

          // Atualiza a lista no painel
          if (snapshot.empty) {
              notificationList.innerHTML = '<li class="notification-item empty">Nenhuma notificação.</li>';
          } else {
              notificationList.innerHTML = snapshot.docs.map(doc => {
                  const notif = doc.data();
                  return `
                      <li class="notification-item ${notif.read ? 'read' : ''}">
                          <a href="${notif.link}">${notif.text}</a>
                      </li>
                  `;
              }).join('');
          }
      });
  }

  async function markNotificationsAsRead() {
      const q = query(
          notificationsCollection,
          where("userId", "==", currentUser.uid),
          where("read", "==", false)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach(doc => {
          batch.update(doc.ref, { read: true });
      });

      await batch.commit();
  }

  // --- MUDANÇA: Funções auxiliares para criar elementos do formulário ---

  // Cria uma linha de input para uma sub-etapa
  function createSubstepInputRow(name = "", pendingDescription = "") {
    // MUDANÇA: Gera um ID único para o textarea de pendingDescription
    const uniqueId = `substep-id-${Math.random().toString(36).substr(2, 9)}`;

    const row = document.createElement("div");
    row.className = "substep-input-row";
    row.innerHTML = `
      <input type="text" name="substepName" placeholder="Nome da sub-etapa" value="${name}" data-id="${uniqueId}" required />
      <button type="button" class="btn-icon btn-delete-substep" title="Remover Sub-etapa"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
    `;
    // MUDANÇA: Substitui o textarea por um select com opções pré-definidas.
    const pendingSelect = document.createElement('select');
    pendingSelect.name = `substepPendingDescription`;
    pendingSelect.dataset.id = uniqueId;
    pendingSelect.classList.add('substep-pending-description');

    const options = ['<option value="">Nenhuma pendência</option>'];
    pendingOptions.forEach(opt => {
        const isSelected = (pendingDescription === opt) ? 'selected' : '';
        options.push(`<option value="${opt}" ${isSelected}>${opt}</option>`);
    });
    pendingSelect.innerHTML = options.join('');

    row.appendChild(pendingSelect);
    return row;
  }

  // Cria um grupo completo de etapa (com container de sub-etapas e botões)
  function createStepGroupElement(step = null) {
    const group = document.createElement("div");
    group.className = "step-group-modal";

    const stepName = step ? step.name : "";
    const stepColor = step ? step.color : "#808080"; // Cinza como padrão
    const stepResponsibleId = step ? step.responsibleId : null; // MUDANÇA
    const subtasks = step // CORREÇÃO: Garante que a lista de sub-etapas seja sempre um array
      ? step.subtasks || []
      : [{ name: "Tarefa Padrão", completed: false }];

    // MUDANÇA: Cria as opções para o select de responsáveis da etapa
    const responsibleOptions = teamMembers
      .map(member => `<option value="${member.id}" ${stepResponsibleId === member.id ? 'selected' : ''}>${member.name}</option>`)
      .join('');
    const responsibleSelectHtml = `
      <select name="stepResponsible">
        <option value="">Ninguém</option>
        ${responsibleOptions}
      </select>`;

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
        <input type="color" name="stepColor" title="Cor da Etapa" value="${stepColor}" />
        <button type="button" class="btn-icon btn-delete-step" title="Remover Etapa"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
      </div>
      <div class="form-group">
        <label>Responsável pela Etapa</label>
        ${responsibleSelectHtml}
      </div>
      <div class="form-group">
        <label>Tipo de Sub-etapa</label>
        <select class="substep-type-selector">
            <option value="text" ${initialType === "text" ? "selected" : ""}>Texto Livre</option>
            <option value="units" ${initialType === "units" ? "selected" : ""}>4 Unidades</option>
        </select>
      </div>
      <div class="substeps-container-modal">
        ${subtasks.map(st => createSubstepInputRow(st.name, st.pendingDescription).outerHTML).join("")}
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
