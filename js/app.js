/**
 * PULSE OS - Central Intelligence
 * Sincronização Total: Google Sheets (Acessos e Dados) + Clima + NPS + Sidebar Retrátil
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

// Estado Inicial do Sistema
let appState = {
    login: "USER_PULSE",
    energy_mg: 0,
    water_ml: 0,
    sidebarCollapsed: false,
    perfil: { 
        peso: 80, altura: 175, idade: 25, sexo: 'M', estado: 'CE', cidade: 'Fortaleza', 
        alcoholStart: '', alcoholTitle: 'SEM ÁLCOOL', alcoholTarget: 30
    },
    veiculo: { 
        tipo: 'Moto', montadora: 'Yamaha', modelo: 'Fazer 250', consumo: 29, km: 35000, oleo: 38000, historico: [] 
    },
    tarefas: [],
    transacoes: [],
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud" }
};

let autoSaveTimeout;

// --- SISTEMA DE LOGIN ---
window.doLogin = async () => {
    const user = document.getElementById('login-user')?.value.trim();
    const pass = document.getElementById('login-pass')?.value.trim();
    const btn = document.getElementById('btn-login');
    const msg = document.getElementById('login-msg');

    if (!user || !pass) { msg.innerText = "Campos obrigatórios!"; return; }
    
    btn.disabled = true;
    btn.innerText = "VERIFICANDO...";

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user, pass })
        });
        const result = await response.json();

        if (result.success) {
            appState.login = user;
            if (result.data) appState = { ...appState, ...result.data }; // Carrega dados da nuvem se existirem
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            msg.innerText = "Acesso Negado. Verifique os dados.";
            btn.disabled = false;
            btn.innerText = "ENTRAR";
        }
    } catch (e) {
        msg.innerText = "Erro na conexão com o Banco de Dados.";
        btn.disabled = false;
        btn.innerText = "ENTRAR";
    }
};

// --- SINCRONIZAÇÃO DE DADOS ---
const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));
const loadLocalData = () => { const s = localStorage.getItem('pulse_state'); if (s) appState = JSON.parse(s); };

const saveCloudData = async () => {
    saveLocalData();
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.error("Erro sync nuvem", e); }
};

// --- INTERFACE DINÂMICA (SIDEBAR E HEADER) ---
window.toggleSidebar = () => {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    saveLocalData();
    updateGlobalUI();
};

const adjustMainContentMargin = () => {
    const main = document.querySelector('.flex-1.md\\:ml-64, .flex-1.md\\:ml-20');
    if (main) {
        if (appState.sidebarCollapsed) { main.classList.replace('md:ml-64', 'md:ml-20'); }
        else { main.classList.replace('md:ml-20', 'md:ml-64'); }
    }
};

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
        { id: 'financas', label: 'Money', icon: 'wallet' },
        { id: 'relatorio', label: 'Relatório', icon: 'bar-chart-3' }
    ];

    navPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300">
            <div class="p-6 flex items-center justify-between">
                <h1 class="text-2xl font-black tracking-tighter text-blue-500 italic ${isCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all">
                    <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="flex-1 px-3 space-y-2 mt-4">
                ${menuItems.map(item => `
                    <button onclick="window.openTab('${item.id}')" title="${item.label}" class="w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === item.id ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i> 
                        <span class="${isCollapsed ? 'hidden' : 'block'}">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="p-3 border-t border-white/5">
                <button onclick="window.openTab('ajustes')" class="w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === 'ajustes' ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:bg-white/5'}">
                    <i data-lucide="settings" class="w-5 h-5 flex-shrink-0"></i>
                    <span class="${isCollapsed ? 'hidden' : 'block'}">Ajustes</span>
                </button>
            </div>
        </aside>
    `;

    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2 italic">
                    ${currentPage.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500">${appState.perfil.cidade.toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span id="header-weather-info" class="text-slate-400 flex items-center gap-1">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <div class="flex items-center gap-3">
                    <button onclick="window.addMonster()" class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 active:scale-95 transition-all">
                        <i data-lucide="zap" class="w-5 h-5"></i>
                    </button>
                </div>
            </header>
        `;
    }
};

// --- LOGICA GLOBAL DE UI ---
const updateGlobalUI = () => {
    injectInterface();
    adjustMainContentMargin();
    
    const p = appState.perfil;
    const waterGoal = p.peso * 35;
    const energyLimit = 400;

    const update = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    update('dash-water-cur', appState.water_ml);
    update('dash-water-goal', waterGoal);
    update('dash-energy-val', appState.energy_mg);
    update('dash-nps-val', appState.nps_mes);

    // Dashboard específico
    const wBar = document.getElementById('dash-water-bar'); if(wBar) wBar.style.width = `${Math.min((appState.water_ml/waterGoal)*100, 100)}%`;
    const gauge = document.getElementById('energy-gauge-path'); if(gauge){ const pct = Math.min((appState.energy_mg/energyLimit)*100, 100); gauge.style.strokeDashoffset = 226.2 - (pct/100)*226.2; }

    // Carregar ícones Lucide (Fix para ícones que somem)
    if (window.lucide) lucide.createIcons();
};

// --- WEATHER & NPS FETCH ---
const fetchWeather = async () => {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-3.73&longitude=-38.52&current_weather=true`);
        const data = await response.json();
        appState.weather = { temp: Math.round(data.current_weather.temperature), icon: "sun" };
        updateGlobalUI();
    } catch(e) {}
};

const fetchNPSData = async () => {
    try {
        const r = await fetch(NPS_SCRIPT_URL);
        const d = await r.json();
        appState.nps_mes = d.nps || d.valor || d;
        updateGlobalUI();
    } catch(e) { appState.nps_mes = "ERR"; }
};

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    if (!window.location.pathname.includes('index')) {
        fetchWeather();
        fetchNPSData();
    }
});

window.openTab = (p) => { window.location.href = p + ".html"; };