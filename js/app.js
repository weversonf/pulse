/**
 * PULSE OS - Central Intelligence v3.1 (Master Sync + Robust UI)
 * Blindagem contra erros de dados e Sincronização GitHub/Google Sheets
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";

// Estado Inicial Padrão
const getInitialState = () => ({
    login: "",
    energy_mg: 0,
    water_ml: 0,
    sidebarCollapsed: false,
    perfil: { peso: 80, altura: 175, idade: 30, sexo: 'M', estado: '', cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30, alcoholTitle: 'SEM ÁLCOOL' },
    veiculo: { tipo: 'Moto', montadora: 'YAMAHA', modelo: 'FAZER 250', consumo: 29, km: 35000, oleo: 38000, historico: [] },
    tarefas: [],
    transacoes: [],
    nps_mes: "75",
    weather: { temp: "--", icon: "cloud", color: "text-slate-400" }
});

let appState = getInitialState();

// --- INJEÇÃO DE INTERFACE (CABECALHO E MENU) ---
// Movido para o topo para garantir prioridade de carregamento

const injectInterface = () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    const header = document.getElementById('header-placeholder');
    
    // Lógica de Path robusta para GitHub Pages
    const urlPath = window.location.pathname.split('/').pop().split('.')[0];
    const path = urlPath || 'dashboard';
    
    const isColl = appState.sidebarCollapsed;

    if (sidebar) {
        const items = [
            { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
            { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
            { id: 'veiculo', label: 'Moto', icon: 'bike', color: 'text-orange-500' },
            { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
            { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500' }
        ];

        sidebar.innerHTML = `
            <aside class="hidden md:flex flex-col ${isColl ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic ${isColl ? 'hidden' : 'block'}">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="${isColl ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 space-y-2 mt-4">
                    ${items.map(i => `
                        <button onclick="window.openTab('${i.id}')" class="w-full flex items-center ${isColl ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-500 hover:bg-white/5'}">
                            <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                            <span class="${isColl ? 'hidden' : 'block'} ml-3">${i.label}</span>
                        </button>
                    `).join('')}
                </nav>
                <div class="p-3 border-t border-white/5">
                    <button onclick="window.openTab('ajustes')" class="w-full flex items-center ${isColl ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
                        <span class="${isColl ? 'hidden' : 'block'} ml-3">Ajustes</span>
                    </button>
                </div>
            </aside>
            <!-- Mobile Nav -->
            <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-[60] px-2 h-16 flex items-center justify-around italic">
                ${items.map(i => `
                    <button onclick="window.openTab('${i.id}')" class="flex flex-col items-center transition-all ${path === i.id ? 'text-blue-500' : 'text-slate-500'}">
                        <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                        <span class="text-[7px] font-black uppercase tracking-tighter italic">${i.label}</span>
                    </button>
                `).join('')}
                <button onclick="window.openTab('ajustes')" class="flex flex-col items-center ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}">
                    <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
                    <span class="text-[7px] font-black uppercase tracking-tighter italic">SET</span>
                </button>
            </nav>
        `;
    }

    if (header) {
        header.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    ${path.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500 italic">${(appState.perfil.cidade || 'FORTALEZA').toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span class="flex items-center gap-1 text-white font-black italic">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3 ${appState.weather.color || 'text-slate-400'}"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <button onclick="window.openFuelModal()" class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-all shadow-lg shadow-orange-950/20">
                    <i data-lucide="fuel" class="w-5 h-5 text-orange-500"></i>
                </button>
            </header>
        `;
    }
};

// --- UPDATE UI CENTRALIZADO ---

const updateGlobalUI = () => {
    // Injeção de interface deve ser a primeira coisa
    injectInterface();
    
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.style.marginLeft = appState.sidebarCollapsed ? '5rem' : '16rem';
    }
    
    const updateText = (id, val) => { 
        const el = document.getElementById(id); 
        if (el) el.innerText = val !== undefined && val !== null ? val : "0"; 
    };
    
    // Saúde & Dashboard
    updateText('dash-water-cur', appState.water_ml);
    updateText('dash-energy-val', appState.energy_mg);
    updateText('dash-nps-val', appState.nps_mes);
    updateText('water-current-display', appState.water_ml);
    updateText('energy-current-display', appState.energy_mg);
    
    // Veículo
    updateText('bike-km-display', appState.veiculo.km);
    updateText('bike-oil-display', appState.veiculo.oleo);
    const vName = (appState.veiculo.modelo || "FAZER 250");
    updateText('bike-name-display', vName.toUpperCase());

    // Tarefas
    const pendentes = appState.tarefas.filter(t => t.status === 'Pendente').length;
    updateText('task-count', pendentes);
    updateText('dash-tasks-remaining', pendentes);
    updateText('dash-tasks-progress', appState.tarefas.filter(t => t.status === 'Concluído').length);

    // Barras de Progresso
    const wPct = Math.min((appState.water_ml / 3500) * 100, 100);
    const ePct = Math.min((appState.energy_mg / 400) * 100, 100);
    
    const wBar = document.getElementById('dash-water-bar') || document.getElementById('water-bar');
    if (wBar) wBar.style.width = wPct + '%';
    const eBar = document.getElementById('energy-bar');
    if (eBar) eBar.style.width = ePct + '%';

    // Finanças
    const saldo = appState.transacoes.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    updateText('dash-saldo', saldo.toLocaleString('pt-BR'));
    updateText('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR'));

    renderWorkTasks();
    renderExtratos();
    
    // Inicializa ícones após injeção
    if (window.lucide) {
        lucide.createIcons();
    }
};

// --- RENDERIZADORES DE LISTAS ---

const renderExtratos = () => {
    const list = document.getElementById('bike-history-list') || document.getElementById('fin-extrato-list');
    if (!list) return;

    const isBikePage = !!document.getElementById('bike-history-list');
    const data = isBikePage ? (appState.veiculo.historico || []) : (appState.transacoes || []);
    const sorted = [...data].sort((a, b) => b.id - a.id).slice(0, 15);

    if (sorted.length === 0) {
        list.innerHTML = `<p class="text-[8px] font-black uppercase text-slate-700 text-center py-8 italic">Nenhum registro encontrado</p>`;
        return;
    }

    list.innerHTML = sorted.map(h => {
        const val = parseFloat(h.valor || 0);
        return `
            <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group transition-all italic">
                <div class="flex items-center gap-4 italic">
                    <div class="w-10 h-10 ${h.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'} rounded-xl flex items-center justify-center">
                        <i data-lucide="${h.tipo === 'Receita' ? 'trending-up' : (h.tipo === 'Abastecimento' ? 'fuel' : 'wrench')}"></i>
                    </div>
                    <div class="italic">
                        <p class="text-xs font-black uppercase text-white leading-tight italic">${h.desc || h.tipo || "LANÇAMENTO"}</p>
                        <p class="text-[8px] font-bold text-slate-500 uppercase mt-0.5 italic leading-tight">
                            ${h.data || ''} ${h.km ? '• ' + h.km + ' KM' : ''} • R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                <p class="text-[8px] font-black text-slate-600 uppercase italic text-right">${h.detalhes || h.cat || ''}</p>
            </div>
        `;
    }).join('');
};

const renderWorkTasks = () => {
    const list = document.getElementById('work-task-active-list');
    if (!list) return;
    const sorted = [...appState.tarefas].sort((a,b) => (a.status === 'Concluído' ? 1 : -1));
    list.innerHTML = sorted.map(t => `
        <div class="glass-card p-5 rounded-3xl flex items-center justify-between transition-all ${t.status === 'Concluído' ? 'opacity-40' : ''}">
            <div class="flex items-center gap-4 italic">
                <button onclick="window.toggleTask(${t.id})" class="w-6 h-6 rounded-lg border-2 ${t.status === 'Concluído' ? 'bg-sky-500 border-sky-500' : 'border-white/10'} flex items-center justify-center">
                    ${t.status === 'Concluído' ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
                <div class="italic">
                    <p class="text-xs font-black uppercase italic ${t.status === 'Concluído' ? 'line-through text-slate-500' : 'text-white'}">${t.title}</p>
                    <p class="text-[8px] font-bold text-slate-500 uppercase italic mt-0.5">${t.type} • ${t.requester} • ${t.deadline || 'S/ DATA'}</p>
                </div>
            </div>
            <button onclick="appState.tarefas = appState.tarefas.filter(x => x.id !== ${t.id}); updateGlobalUI(); saveCloudBackup();" class="text-slate-700 hover:text-red-500 transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState = { ...appState, ...parsed };
        } catch (e) { console.error("PULSE: Erro no parse local."); }
    }
};

const saveCloudBackup = async () => {
    saveLocalData();
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.warn("PULSE: Backup nuvem falhou."); }
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
    } catch (e) { console.error("PULSE: Erro no Google Sheets."); }
};

// --- NAVEGAÇÃO E AUXILIARES ---

window.toggleSidebar = () => { 
    appState.sidebarCollapsed = !appState.sidebarCollapsed; 
    saveLocalData(); 
    updateGlobalUI(); 
};

window.openTab = (p) => { 
    // Garante compatibilidade com extensões .html e caminhos GitHub
    window.location.href = p + ".html"; 
};

window.doLogin = async () => {
    const user = document.getElementById('login-user')?.value;
    const pass = document.getElementById('login-pass')?.value;
    const msg = document.getElementById('login-msg');

    if (!user || !pass) {
        if (msg) msg.innerText = "PREENCHA TODOS OS CAMPOS";
        return;
    }

    if (msg) msg.innerText = "VERIFICANDO...";

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: user, pass: pass })
        });
        const result = await response.json();

        if (result.success) {
            appState.login = result.user;
            if (result.data) {
                appState = { ...appState, ...result.data, login: result.user };
            }
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            if (msg) msg.innerText = result.error || "ACESSO NEGADO";
        }
    } catch (e) {
        if (msg) msg.innerText = "ERRO DE LIGAÇÃO";
        console.error(e);
    }
};

const refreshFromCloud = async () => {
    if (!appState.login) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: appState.login, pass: "REFRESH" })
        });
        const result = await response.json();
        if (result.success && result.data) {
            appState = { ...appState, ...result.data, login: appState.login };
            updateGlobalUI();
        }
    } catch (e) { console.warn("PULSE: Falha no refresh."); }
};

const fetchWeatherReal = async () => {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-3.73&longitude=-38.52&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        let icon = 'cloud'; let color = 'text-blue-300';
        if (code <= 1) { icon = 'sun'; color = 'text-yellow-400'; }
        else if (code <= 3) { icon = 'cloud-sun'; color = 'text-orange-400'; }
        else if (code >= 51 && code <= 67) { icon = 'cloud-rain'; color = 'text-blue-400'; }
        appState.weather = { temp: Math.round(data.current_weather.temperature), icon, color };
        updateGlobalUI();
    } catch (e) {}
};

// --- INICIALIZAÇÃO ---

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    fetchWeatherReal();
    if (appState.login && !window.location.pathname.includes('index')) {
        refreshFromCloud();
    }
});
