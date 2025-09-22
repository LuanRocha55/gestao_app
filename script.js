document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'management_app_services';
    let services = [];

    const serviceContainer = document.getElementById('service-container');
    const themeToggle = document.getElementById('theme-toggle');
    const addServiceBtn = document.getElementById('add-service-btn');
    const modal = document.getElementById('add-service-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const addServiceForm = document.getElementById('add-service-form');
    const addStepBtn = document.getElementById('add-step-btn');
    const stepsContainer = document.getElementById('steps-container');

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
                    id: 1, name: 'Desenvolvimento do Novo App', responsible: 'Ana Silva',
                    steps: [
                        { name: 'Planejamento e Escopo', completed: true, assignedTo: 'Ana Silva' },
                        { name: 'Design da UI/UX', completed: true, assignedTo: 'Carlos' },
                        { name: 'Desenvolvimento do Frontend', completed: false, assignedTo: 'Beatriz' },
                        { name: 'Desenvolvimento do Backend', completed: false, assignedTo: 'Daniel' },
                    ]
                },
                {
                    id: 2, name: 'Campanha de Marketing', responsible: 'Bruno Costa',
                    steps: [
                        { name: 'Definir público-alvo', completed: true, assignedTo: 'Bruno Costa' },
                        { name: 'Criar criativos', completed: true, assignedTo: 'Fernanda' },
                        { name: 'Configurar anúncios', completed: true, assignedTo: 'Bruno Costa' },
                        { name: 'Analisar resultados', completed: false, assignedTo: 'Gabriela' },
                    ]
                }
            ];
        }
    }

    // --- Função para Renderizar os Cartões de Serviço ---
    function renderServices() {
        serviceContainer.innerHTML = ''; // Limpa o container antes de renderizar

        services.forEach(service => {
            const completedSteps = service.steps.filter(step => step.completed).length;
            const totalSteps = service.steps.length;

            const card = document.createElement('div');
            card.className = 'service-card';
            card.dataset.id = service.id; // Adiciona um identificador único ao elemento do card

            const stepsHtml = service.steps.map((step, index) => `
                <li class="step-item">
                    <input type="checkbox" id="step-${service.id}-${index}" data-step-index="${index}" ${step.completed ? 'checked' : ''}>
                    <label for="step-${service.id}-${index}">${step.name} ${step.assignedTo ? `<span class="step-assignee">(${step.assignedTo})</span>` : ''}</label>
                </li>
            `).join('');

            card.innerHTML = `
                <div class="card-header">
                    <h2>${service.name}</h2>
                    <button class="btn-icon btn-edit" title="Editar Serviço" data-service-id="${service.id}">✏️</button>
                </div>
                <p class="responsible">Responsável: ${service.responsible}</p>
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

    // --- Lógica do Modal ---
    addServiceBtn.addEventListener('click', () => {
        resetModal(); // Garante que o modal está em modo "Adicionar"
        modal.style.display = 'block';
    });

    function resetModal() {
        addServiceForm.reset();
        // Reseta os campos de etapa para apenas um
        stepsContainer.innerHTML = `
            <div class="step-input-row">
                <input type="text" name="stepName" placeholder="Nome da etapa" required>
                <input type="text" name="stepAssignee" placeholder="Responsável pela etapa">
            </div>
        `;
        // Garante que não está em modo de edição
        delete addServiceForm.dataset.editingId;
        // Reseta o título e o botão
        modal.querySelector('h2').textContent = 'Adicionar Novo Serviço';
        modal.querySelector('button[type="submit"]').textContent = 'Criar Serviço';
    }

    function openEditModal(service) {
        resetModal(); // Limpa o formulário primeiro
        addServiceForm.dataset.editingId = service.id;

        // Preenche os campos com os dados do serviço
        addServiceForm.serviceName.value = service.name;
        addServiceForm.responsibleName.value = service.responsible;

        stepsContainer.innerHTML = service.steps.map(step =>
            `<div class="step-input-row">
                <input type="text" name="stepName" value="${step.name}" required>
                <input type="text" name="stepAssignee" value="${step.assignedTo || ''}">
            </div>`
        ).join('');

        modal.querySelector('h2').textContent = 'Editar Serviço';
        modal.querySelector('button[type="submit"]').textContent = 'Salvar Alterações';
        modal.style.display = 'block';
    }

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    addStepBtn.addEventListener('click', () => {
        const newRow = document.createElement('div');
        newRow.className = 'step-input-row';
        newRow.innerHTML = `
            <input type="text" name="stepName" placeholder="Nome da etapa" required>
            <input type="text" name="stepAssignee" placeholder="Responsável pela etapa">
        `;
        stepsContainer.appendChild(newRow);
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    // --- Lógica de Interação com Cards (Event Delegation) ---
    serviceContainer.addEventListener('click', (event) => {
        const target = event.target;
        // Lógica para marcar/desmarcar etapas (movida para 'change' para melhor prática)
        if (target.matches('input[type="checkbox"]')) {
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

        // Lógica para editar um serviço
        if (target.matches('.btn-edit')) {
            const serviceId = parseInt(target.dataset.serviceId, 10);
            const serviceToEdit = services.find(s => s.id === serviceId);
            if (serviceToEdit) {
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
                const assignedTo = row.querySelector('input[name="stepAssignee"]').value;
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
                serviceToUpdate.responsible = event.target.responsibleName.value;
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
                responsible: event.target.responsibleName.value,
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