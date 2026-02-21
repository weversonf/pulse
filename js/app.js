/**
 * PULSE OS - Central Intelligence
 * Sincronização: JSON Global (Aba Dados) + Transações Linha a Linha (Aba Financas)
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

let appState = {
    login: "",
    energy_mg: 0,
    water_ml: 0,
    sidebarCollapsed: false,
    perfil: { peso: 80, altura: 175, cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30, alcoholTitle: 'SEM ÁLCOOL' },
    veiculo: { tipo: 'Moto', modelo: 'Fazer 250', km: 35000, historico: [] },
    tarefas: [],
    transacoes: [],
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud" }
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => {
    localStorage.setItem('pulse_state', JSON.stringify(appState));
};

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState = { ...appState, ...parsed };
        } catch (e) {
            console.error("PULSE: Erro ao carregar dados locais.");
        }
    }
};

const saveCloudBackup = async () => {
    saveLocalData();
    if (!appState.login) return;
    try {
        // Envio silencioso para a aba "Dados"
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.warn("PULSE: Erro no backup cloud."); }
};

const saveToFinancasSheet = async (transacao) => {
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'appendFinanca', 
                userId: appState.login, 
                rowData: [transacao.id, transacao.data, transacao.tipo, transacao.cat, transacao.desc, transacao.valor]
            })
        });
    } catch (e) { console.error("Erro Financas Cloud", e); }
};

// Força o download dos dados da nuvem para garantir sincronia
const refreshFromCloud = async () => {
    if (!appState.login) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: appState.login, pass: "REFRESH" })
        });
        const result = await response.json();
        if (result.success && result.data) {
            appState = { ...appState, ...result.data };
            updateGlobalUI();
        }
    } catch (e) { console.error("Refresh falhou", e); }
};

// --- LOGIN ---

window.doLogin = async () => {
    const userField = document.getElementById('login-user');
    const passField = document.getElementById('login-pass');
    const btn = document.getElementById('btn-login');
    const msg = document.getElementById('login-msg');

    if (!userField || !passField) return;

    const user = userField.value.trim();
    const pass = passField.value.trim();

    if (!user || !pass) {
        if (msg) msg.innerText = "Campos obrigatórios!";
        return;
    }

    if (btn) { btn.disabled = true; btn.innerText = "AUTENTICANDO..."; }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user, pass })
        });
        const result = await response.json();
        if (result.success) {
            appState.login = user;
            if (result.data) appState = { ...appState, ...result.data };
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            if (msg) msg.innerText = "Acesso Negado.";
            if (btn) { btn.disabled = false; btn.innerText = "ENTRAR"; }
        }
    } catch (e) { 
        if (msg) msg.innerText = "Erro na conexão.";
        if (btn) { btn.disabled = false; btn.innerText = "ENTRAR"; } 
    }
};

// --- SAÚDE (ÁGUA E MONSTER) ---

window.addWater = (ml) => {
    appState.water_ml += ml;
    updateGlobalUI();
    saveCloudBackup();
};

window.addMonster = () => { 
    appState.energy_mg += 160; 
    const t = { 
        id: Date.now(), 
        tipo: 'Despesa', 
        cat: 'Saúde', 
        desc: 'MONSTER ENERGY', 
        valor: 10, 
        data: new Date().toLocaleDateString('pt-BR') 
    };
    appState.transacoes.push(t);
    saveToFinancasSheet(t);
    updateGlobalUI(); 
    saveCloudBackup(); 
};

window.failChallenge = () => {
    const overlay = document.getElementById('panic-overlay');
    if(overlay) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 2000);
    }
    appState.perfil.alcoholStart = new Date().toISOString().split('T')[0];
    updateGlobalUI();
    saveCloudBackup();
};

// --- WORK (ATIVIDADES) ---

window.addWorkTask = () => {
    const titleEl = document.getElementById('work-task-title');
    const typeEl = document.getElementById('work-task-type');
    const requesterEl = document.getElementById('work-task-requester');
    const deadlineEl = document.getElementById('work-task-deadline');

    if (!titleEl || !titleEl.value.trim()) return;

    const title = titleEl.value.trim();
    const type = typeEl ? typeEl.value : "Operacional";
    const requester = (requesterEl && requesterEl.value.trim()) ? requesterEl.value.trim() : "EU";
    const deadline = deadlineEl ? deadlineEl.value : "";

    const novaTarefa = {
        id: Date.now(),
        title: title.toUpperCase(),
        type,
        requester: requester.toUpperCase(),
        deadline,
        status: 'Pendente'
    };

    appState.tarefas.push(novaTarefa);
    titleEl.value = ""; // Limpa o campo
    
    updateGlobalUI();
    saveCloudBackup();
};

window.toggleTask = (id) => {
    const task = appState.tarefas.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'Pendente' ? 'Concluído' : 'Pendente';
        updateGlobalUI();
        saveCloudBackup();
    }
};

const renderWorkTasks = () => {
    const list = document.getElementById('work-task-active-list');
    if (!list) return;

    const pendentes = appState.tarefas.filter(t => t.status === 'Pendente');
    const countEl = document.getElementById('task-count');
    if (countEl) countEl.innerText = pendentes.length;

    // Ordena para mostrar pendentes primeiro
    const sortedTasks = [...appState.tarefas].sort((a, b) => (a.status === 'Concluído' ? 1 : -1));

    list.innerHTML = sortedTasks.map(t => `
        <div class="glass-card p-5 rounded-3xl flex items-center justify-between group transition-all ${t.status === 'Concluído' ? 'opacity-40' : ''}">
            <div class="flex items-center gap-4">
                <button onclick="window.toggleTask(${t.id})" class="w-6 h-6 rounded-lg border-2 ${t.status === 'Concluído' ? 'bg-blue-500 border-blue-500' : 'border-white/10'} flex items-center justify-center transition-all">
                    ${t.status === 'Concluído' ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
                <div>
                    <p class="text-xs font-black uppercase tracking-tight ${t.status === 'Concluído' ? 'line-through' : 'text-white'}">${t.title}</p>
                    <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">${t.type} • ${t.requester} • ${t.deadline || 'S/ DATA'}</p>
                </div>
            </div>
            <button onclick="window.deleteTask(${t.id})" class="text-slate-700 hover:text-red-500 transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};

window.deleteTask = (id) => {
    appState.tarefas = appState.tarefas.filter(x => x.id !== id);
    updateGlobalUI();
    saveCloudBackup();
};

// --- INTERFACE E UI UPDATE ---

window.toggleSidebar = () => { 
    appState.sidebarCollapsed = !appState.sidebarCollapsed; 
    saveLocalData(); 
    updateGlobalUI(); 
};

const updateGlobalUI = () => {
    injectInterface();
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.classList.toggle('md:ml-64', !appState.sidebarCollapsed);
        main.classList.toggle('md:ml-20', appState.sidebarCollapsed);
    }
    
    const updateText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    // Metas
    const waterGoal = 3500;
    const energyLimit = 400;

    // Atualiza Textos de Status
    updateText('dash-water-cur', appState.water_ml);
    updateText('dash-energy-val', appState.energy_mg);
    updateText('water-current-display', appState.water_ml);
    updateText('energy-current-display', appState.energy_mg);
    updateText('bike-km-display', appState.veiculo.km);
    
    const pendentesCount = appState.tarefas.filter(t => t.status === 'Pendente').length;
    updateText('dash-tasks-remaining', pendentesCount);

    // Atualiza Barras de Saúde
    const waterPct = Math.min((appState.water_ml / waterGoal) * 100, 100);
    const energyPct = Math.min((appState.energy_mg / energyLimit) * 100, 100);

    // Itera sobre possíveis IDs de barras (Dashboard e Página Saúde)
    ['dash-water-bar', 'water-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = waterPct + '%';
    });
    
    const waterPctText = document.getElementById('water-percent-text');
    if (waterPctText) waterPctText.innerText = Math.round(waterPct) + '%';

    ['energy-bar', 'dash-energy-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = energyPct + '%';
    });
    
    const energyPctText = document.getElementById('energy-percent-text');
    if (energyPctText) energyPctText.innerText = Math.round(energyPct) + '%';

    // Gauge Circular do Dashboard
    const gauge = document.getElementById('energy-gauge-path');
    if (gauge) {
        // 226.2 é o comprimento do círculo (2 * PI * 36)
        gauge.style.strokeDashoffset = 226.2 - (energyPct / 100) * 226.2;
    }

    // Desafio Disciplina (Álcool)
    if (appState.perfil.alcoholStart) {
        const start = new Date(appState.perfil.alcoholStart);
        const now = new Date();
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const target = appState.perfil.alcoholTarget || 30;
        
        updateText('alcohol-days-count', diff);
        updateText('alcohol-target-display', target);
        updateText('alcohol-challenge-title', appState.perfil.alcoholTitle || 'SEM ÁLCOOL');
        
        const alcBar = document.getElementById('alcohol-bar');
        if (alcBar) alcBar.style.width = Math.min((diff / target) * 100, 100) + '%';
        
        const statusText = document.getElementById('alcohol-status-text');
        if (statusText) statusText.innerText = diff >= target ? "CONCLUÍDO" : "EM CURSO";
    }

    // Somas Financeiras para o Dashboard
    const saldoTotal = appState.transacoes.reduce((acc, t) => acc + (t.tipo.toLowerCase() === 'receita' ? t.valor : -t.valor), 0);
    updateText('dash-saldo', saldoTotal.toLocaleString('pt-BR'));

    // Renderiza listas
    renderWorkTasks();
    
    if (window.lucide) lucide.createIcons();
};

// --- INICIALIZAÇÃO DA INTERFACE ---

const injectInterface = () => {
    const navPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!navPlaceholder) return;

    const currentPage = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
    const isCollapsed = appState.sidebarCollapsed;
    
    const menuItems = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard' },
        { id: 'saude', label: 'Saúde', icon: 'activity' },
        { id: 'veiculo', label: 'Moto', icon: 'bike' },
        { id: 'work', label: 'WORK', icon: 'briefcase' },
        { id: 'financas', label: 'Money', icon: 'wallet' }
    ];

    navPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 overflow-hidden italic">
            <div class="p-6 flex items-center justify-between">
                <h1 class="text-2xl font-black tracking-tighter text-blue-500 italic ${isCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all">
                    <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="flex-1 px-3 space-y-2 mt-4">
                ${menuItems.map(item => `
                    <button onclick="window.openTab('${item.id}')" title="${item.label}" class="w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === item.id ? 'text-blue-500 bg-white/5 shadow-lg shadow-blue-500/10' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i> 
                        <span class="${isCollapsed ? 'hidden' : 'block'}">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
        </aside>
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-[60] px-2 pb-safe">
            <div class="flex items-center justify-around h-16">
                ${menuItems.map(item => `
                    <button onclick="window.openTab('${item.id}')" class="flex flex-col items-center justify-center gap-1 transition-all ${currentPage === item.id ? 'text-blue-500' : 'text-slate-500'}">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        <span class="text-[7px] font-black uppercase tracking-tighter">${item.label}</span>
                    </button>
                `).join('')}
            </div>
        </nav>
    `;

    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    ${currentPage.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500">${(appState.perfil.cidade || 'FORTALEZA').toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span id="header-weather-info" class="text-slate-400 flex items-center gap-1 italic">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <button onclick="window.addMonster()" class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 active:scale-95 transition-all">
                    <i data-lucide="zap" class="w-5 h-5"></i>
                </button>
            </header>
        `;
    }
};

window.openTab = (p) => { window.location.href = p + ".html"; };

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    
    // Tenta sincronizar com a nuvem após carregar o local
    if (!window.location.pathname.includes('index')) {
        refreshFromCloud();
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
        const main = document.getElementById('main-content');
        if (main) main.style.marginLeft = "0";
    } else {
        updateGlobalUI();
    }
});
