document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'management_app_services';
    let services = [];

    const serviceContainer = document.getElementById('service-container');
    const themeToggle = document.getElementById('theme-toggle');
    const addServiceBtn = document.getElementById('add-service-btn');
    const modal = document.getElementById('add-service-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const addServiceForm = document.getElementById('add-service-form');
    const searchInput = document.getElementById('search-input');
    const addStepBtn = document.getElementById('add-step-btn');
    const stepsContainer = document.getElementById('steps-container');

    // --- MUDANÇA: Simulação de uma lista de usuários da equipe ---
    // Em uma aplicação real, isso viria de um banco de dados após o login.
    const teamMembers = [
        { id: 'sergio.sertorio@email.com', name: 'Sérgio Sertório' },
        { id: 'luan.rocha@email.com', name: 'Luan Rocha' },
        { id: 'cleuson.alves@email.com', name: 'Cleuson Alves' },
        { id: 'emanuela.araujo@email.com', name: 'Emanuela de Araujo' },
        { id: 'guilherme.martins@email.com', name: 'Guilherme Martins' },
        { id: 'mateus@email.com', name: 'Mateus' },
        { id: 'janaina.muniz@email.com', name: 'Janaina Muniz' },
    ];
    // Mapeamento para busca rápida de nome por id
    const teamMemberMap = new Map(teamMembers.map(m => [m.id, m.name]));

    // --- Funções Utilitárias ---
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    function isValidEmail(email) {
        return email && emailRegex.test(String(email).toLowerCase());
    }

    // --- Funções de Dados (Salvar e Carregar) ---
    function saveServices() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
    }

    function loadServices() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            services = JSON.parse(saved);
        } else {
            // Dados de exemplo se não houver nada salvo
            services = [
                {
                    id: 1, name: 'Desenvolvimento do Novo App', responsible: 'luan.rocha@email.com', category: 'Desenvolvimento',
                    steps: [
                        { name: 'Planejamento e Escopo', completed: true, assignedTo: 'luan.rocha@email.com' },
                        { name: 'Design da UI/UX', completed: true, assignedTo: 'emanuela.araujo@email.com' },
                        { name: 'Desenvolvimento do Frontend', completed: false, assignedTo: 'guilherme.martins@email.com' },
                        { name: 'Desenvolvimento do Backend', completed: false, assignedTo: 'cleuson.alves@email.com' },
                    ]
                },
                {
                    id: 2, name: 'Campanha de Marketing', responsible: 'sergio.sertorio@email.com', category: 'Marketing',
                    steps: [
                        { name: 'Definir público-alvo', completed: true, assignedTo: 'sergio.sertorio@email.com' },
                        { name: 'Criar criativos', completed: true, assignedTo: 'janaina.muniz@email.com' },
                        { name: 'Configurar anúncios', completed: true, assignedTo: 'sergio.sertorio@email.com' },
                        { name: 'Analisar resultados', completed: false, assignedTo: 'mateus@email.com' },
                    ]
                }
            ];
        }
    }

    // --- Função para Renderizar os Cartões de Serviço ---
    function renderServices() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        const servicesToRender = services.filter(service => {
            if (!searchTerm) return true; // Se a busca estiver vazia, mostra tudo

            const inName = service.name.toLowerCase().includes(searchTerm);
            const inResponsible = (teamMemberMap.get(service.responsible) || '').toLowerCase().includes(searchTerm);
            const inCategory = (service.category || '').toLowerCase().includes(searchTerm);
            const inSteps = service.steps.some(step =>
                step.name.toLowerCase().includes(searchTerm) ||
                (teamMemberMap.get(step.assignedTo) || '').toLowerCase().includes(searchTerm)
            );

            return inName || inResponsible || inCategory || inSteps;
        });

        serviceContainer.innerHTML = ''; // Limpa o container antes de renderizar

        if (servicesToRender.length === 0 && searchTerm) {
            serviceContainer.innerHTML = `<p class="no-results">Nenhum serviço encontrado para "${searchInput.value}".</p>`;
            return;
        }
        // 1. Agrupar serviços por categoria
        const groupedServices = servicesToRender.reduce((acc, service) => {
            const category = service.category || 'Outros'; // Agrupa em 'Outros' se não tiver categoria
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(service);
            return acc;
        }, {});

        // 2. Renderizar por grupo
        Object.keys(groupedServices).sort().forEach(category => {
            // Cria e adiciona o título da categoria
            const titleEl = document.createElement('h3');
            titleEl.className = 'category-title';
            titleEl.textContent = category;
            serviceContainer.appendChild(titleEl);

            // Renderiza os cards dentro da categoria
            groupedServices[category].forEach(service => {
                const completedSteps = service.steps.filter(step => step.completed).length;
                const totalSteps = service.steps.length;

                const card = document.createElement('div');
                card.className = 'service-card';
                card.dataset.id = service.id;

                const responsibleName = teamMemberMap.get(service.responsible) || service.responsible;
                const responsibleHtml = isValidEmail(service.responsible)
                    ? `<a href="mailto:${service.responsible}">${responsibleName}</a>`
                    : responsibleName;

                const stepsHtml = service.steps.map((step, index) => {
                    const assigneeName = teamMemberMap.get(step.assignedTo) || step.assignedTo;
                    const assigneeHtml = isValidEmail(step.assignedTo)
                        ? `<a href="mailto:${step.assignedTo}">${assigneeName}</a>`
                        : assigneeName;
                    const assigneeSpan = step.assignedTo ? `<span class="step-assignee">(${assigneeHtml})</span>` : '';

                    return `<li class="step-item">
                        <input type="checkbox" id="step-${service.id}-${index}" data-step-index="${index}" ${step.completed ? 'checked' : ''}>
                        <label for="step-${service.id}-${index}">${step.name} ${assigneeSpan}</label>
                    </li>`;
                }).join('');

                card.innerHTML = `
                    <div class="card-header">
                        <h2>${service.name}</h2>
                        <button class="btn-icon btn-edit" title="Editar Serviço" data-service-id="${service.id}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65,21.1,6,20.71,5.63L18.37,3.29C18,2.9,17.35,2.9,16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></button>
                    </div>
                    <p class="responsible">Responsável: ${responsibleHtml}</p>
                    <div class="progress-info">
                        <span>Progresso</span>
                        <span class="progress-text">${completedSteps} / ${totalSteps}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%;"></div>
                    </div>
                    <ul class="steps-list">
                        ${stepsHtml}
                    </ul>
                `;
                serviceContainer.appendChild(card);
            });
        });
    }

    // --- Lógica para Troca de Tema ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-theme');
            themeToggle.checked = false;
        }
    }

    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            applyTheme('dark');
            localStorage.setItem('theme', 'dark'); // Salva a preferência
        } else {
            applyTheme('light');
            localStorage.setItem('theme', 'light'); // Salva a preferência
        }
    });

    // --- Lógica da Pesquisa ---
    searchInput.addEventListener('input', () => renderServices());

    // --- Lógica do Modal ---
    addServiceBtn.addEventListener('click', () => {
        resetModal(); // Garante que o modal está em modo "Adicionar"
        modal.style.display = 'block';
    });

    function populateUserDropdown(selectElement, selectedValue = '') {
        selectElement.innerHTML = '<option value="">Ninguém</option>'; // Opção para não atribuir
        teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            if (member.id === selectedValue) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    function resetModal() {
        addServiceForm.reset();
        const mainResponsibleSelect = addServiceForm.querySelector('#responsible-name');
        populateUserDropdown(mainResponsibleSelect);

        // Reseta os campos de etapa para apenas um
        stepsContainer.innerHTML = `
            <div class="step-input-row">
                <input type="text" name="stepName" placeholder="Nome da etapa" required />
                <select name="stepAssignee"></select>
            </div>
        `;
        // Garante que não está em modo de edição
        delete addServiceForm.dataset.editingId;
        // Reseta o título e o botão
        modal.querySelector('h2').textContent = 'Adicionar Novo Serviço';
        modal.querySelector('button[type="submit"]').textContent = 'Criar Serviço';
        // Popula o dropdown da primeira etapa
        populateUserDropdown(stepsContainer.querySelector('select[name="stepAssignee"]'));
    }

    function openEditModal(service) {
        resetModal(); // Limpa o formulário primeiro
        addServiceForm.dataset.editingId = service.id;

        // Preenche os campos com os dados do serviço
        const mainResponsibleSelect = addServiceForm.querySelector('#responsible-name');
        populateUserDropdown(mainResponsibleSelect, service.responsible);
        addServiceForm.querySelector('#service-name').value = service.name;
        addServiceForm.serviceCategory.value = service.category || '';

        stepsContainer.innerHTML = ''; // Limpa antes de adicionar
        service.steps.forEach(step => {
            const newRow = createStepInputRow(step.name, step.assignedTo);
            stepsContainer.appendChild(newRow);
        });
        if (service.steps.length === 0) {
            stepsContainer.appendChild(createStepInputRow());
        }

        modal.querySelector('h2').textContent = 'Editar Serviço';
        modal.querySelector('button[type="submit"]').textContent = 'Salvar Alterações';
        modal.style.display = 'block';
    }

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    function createStepInputRow(name = '', assignee = '') {
        const row = document.createElement('div');
        row.className = 'step-input-row';
        row.innerHTML = `
                <input type="text" name="stepName" required />
                <select name="stepAssignee"></select>
        `;
        const nameInput = row.querySelector('input[name="stepName"]');
        const assigneeSelect = row.querySelector('select[name="stepAssignee"]');
        nameInput.value = name;
        populateUserDropdown(assigneeSelect, assignee);
        return row;
    }

    addStepBtn.addEventListener('click', () => {
        const newRow = createStepInputRow();
        stepsContainer.appendChild(newRow);
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    // --- Lógica de Interação com Cards ---

    // Usar 'change' para checkboxes é mais robusto (funciona com teclado, etc.)
    serviceContainer.addEventListener('change', (event) => {
        const target = event.target;
        if (target.matches('input[type="checkbox"]')) { // Lógica para marcar/desmarcar etapas
            const card = target.closest('.service-card');
            const serviceId = parseInt(card.dataset.id, 10);
            const service = services.find(s => s.id === serviceId);
            const stepIndex = parseInt(target.dataset.stepIndex, 10);

            if (!service) return;

            // Atualiza o status da etapa no array de dados
            service.steps[stepIndex].completed = target.checked;

            saveServices(); // Salva o estado atualizado

            // Atualiza a interface do card específico
            updateCardView(card, service);
        }
    });

    // Usar 'click' para os botões
    serviceContainer.addEventListener('click', (event) => {
        // Lógica para editar um serviço
        const editBtn = event.target.closest('.btn-edit');
        if (editBtn) {
            const serviceId = parseInt(editBtn.dataset.serviceId, 10);
            const serviceToEdit = services.find(s => s.id === serviceId);
            if (serviceToEdit) {
                event.preventDefault(); // Previne qualquer comportamento padrão do botão
                openEditModal(serviceToEdit);
            }
        }
    });

    function updateCardView(cardElement, service) { // A função agora recebe o objeto service
        const progressText = cardElement.querySelector('.progress-text');
        const progressBar = cardElement.querySelector('.progress-bar');

        const completedSteps = service.steps.filter(step => step.completed).length;
        const totalSteps = service.steps.length;

        progressText.textContent = `${completedSteps} / ${totalSteps}`;
        progressBar.style.width = `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%`;
    }

    // --- Lógica para Adicionar Novo Serviço ---
    addServiceForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        const stepInputRows = stepsContainer.querySelectorAll('.step-input-row');
        const steps = Array.from(stepInputRows)
            .map(row => {
                const name = row.querySelector('input[name="stepName"]').value;
                const assignedTo = row.querySelector('select[name="stepAssignee"]').value;
                // Retorna um objeto de etapa, o 'completed' será definido mais tarde
                return { name, assignedTo };
            })
            .filter(step => step.name.trim() !== ''); // Ignora etapas em branco

        const editingId = addServiceForm.dataset.editingId;

        if (editingId) {
            // --- MODO DE EDIÇÃO ---
            const serviceToUpdate = services.find(s => s.id === parseInt(editingId, 10));
            if (serviceToUpdate) {
                serviceToUpdate.name = event.target.serviceName.value;
                serviceToUpdate.responsible = addServiceForm.querySelector('#responsible-name').value;
                serviceToUpdate.category = event.target.serviceCategory.value;
                // Atualiza as etapas, preservando o status 'completed' das que já existiam
                serviceToUpdate.steps = steps.map((newStepData, index) => {
                    const oldStep = serviceToUpdate.steps[index];
                    // Se a etapa antiga existir, mantém seu status 'completed'. Senão, é uma nova etapa.
                    const completed = oldStep ? oldStep.completed : false;
                    return { ...newStepData, completed };
                });
            }
        } else {
            // --- MODO DE CRIAÇÃO ---
            const newService = {
                id: Date.now(), // ID único baseado no timestamp
                name: event.target.serviceName.value,
                responsible: addServiceForm.querySelector('#responsible-name').value,
                category: event.target.serviceCategory.value,
                // Para novos serviços, todas as etapas começam como não concluídas
                steps: steps.map(step => ({ ...step, completed: false }))
            };
            services.push(newService); // Adiciona o novo serviço ao array
        }

        saveServices(); // Salva a nova lista
        renderServices(); // Re-renderiza a lista de serviços

        // Fecha o modal e limpa o formulário
        modal.style.display = 'none';
        resetModal();
    });


    // --- Inicialização ---
    loadServices();
    // Verifica se há um tema salvo no localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    
    // Renderiza os serviços na tela
    renderServices();
});