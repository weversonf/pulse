/**
 * PULSE OS - Central Intelligence v6.5 (NPS External Link & Layout Sync)
 * Makro Engenharia - Fortaleza
 * Gestão de Navegação, Saúde, Finanças, Veículo, NPS Externo e Sincronização.
 */

// URL do Google Apps Script Principal (Sincronização de Dados)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";

// URL do Script de NPS (Cole o link aqui quando tiver)
const NPS_SCRIPT_URL = ""; 

// Estado de interface persistente na sessão
let activeSubmenu = sessionStorage.getItem('pulse_active_submenu');

const getInitialState = (currentLogin = "") => ({
    login: currentLogin,
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    saudeHistorico: [],
    sidebarCollapsed: false,
    perfil: { 
        peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza',
        avatarConfig: { color: 'blue', icon: 'user' },
        alcoholTitle: "Zero Álcool", alcoholStart: "", alcoholTarget: 30
    },
    veiculo: { 
        tipo: 'Moto', montadora: 'YAMAHA', modelo: 'FAZER 250', consumo: 29, 
        km: 0, oleo: 0, historico: [], viagens: [] 
    },
    calibragem: { monster_mg: 160, coffee_ml: 300, coffee_100ml_mg: 40 },
    tarefas: [],
    transacoes: [],
    nps_mes: "85", 
    weather: { temp: "--", icon: "sun", color: "text-yellow-500" }
});

let appState = getInitialState();

// --- PERSISTÊNCIA & SINCRO ---
const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) {
        try {
            appState = { ...appState, ...JSON.parse(saved) };
            checkDailyReset();
        } catch (e) { console.error("PULSE: Erro no carregamento local."); }
    }
};

const checkDailyReset = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    if (appState.lastHealthReset !== today) {
        if (appState.water_ml > 0 || appState.energy_mg > 0) {
            appState.saudeHistorico.push({
                date: appState.lastHealthReset, water: appState.water_ml, energy: appState.energy_mg
            });
        }
        appState.water_ml = 0;
        appState.energy_mg = 0;
        appState.lastHealthReset = today;
        saveLocalData();
        saveCloudBackup();
    }
};

// --- INTEGRAÇÃO NPS EXTERNO ---
const fetchNPSData = async () => {
    if (!NPS_SCRIPT_URL) return;
    try {
        const response = await fetch(NPS_SCRIPT_URL);
        const data = await response.json();
        // Assume-se que o script retorna { nps: "92" } ou similar
        if (data && data.nps) {
            appState.nps_mes = data.nps;
            updateGlobalUI();
        }
    } catch (e) {
        console.warn("PULSE: Não foi possível obter o NPS externo agora.");
    }
};

// --- INTERFACE GLOBAL ---
const updateGlobalUI = () => {
    injectInterface();
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    if (mainContent) {
        mainContent.classList.remove('content-expanded', 'content-collapsed', 'md:ml-64');
        if (window.innerWidth >= 768) {
            mainContent.classList.add(appState.sidebarCollapsed ? 'content-collapsed' : 'content-expanded');
        } else {
            mainContent.style.marginLeft = '0';
        }
    }

    if (sidebar) {
        sidebar.classList.remove('sidebar-expanded', 'sidebar-collapsed');
        sidebar.classList.add(appState.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded');
    }
    
    const updateText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    // Finanças
    const efektivaj = (appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const saldoEfet = efektivaj.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    updateText('dash-saldo', saldoEfet.toLocaleString('pt-BR'));
    updateText('fin-saldo-atual-pag', saldoEfet.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

    // Saúde
    const metaAgua = Math.round((appState.perfil.peso || 90) * 35);
    updateText('water-current-display', appState.water_ml);
    updateText('water-goal-display', metaAgua);
    updateText('dash-water-cur', appState.water_ml);
    updateText('energy-current-display', appState.energy_mg);
    updateText('dash-energy-val', appState.energy_mg);
    if (document.getElementById('dash-water-bar')) {
        document.getElementById('dash-water-bar').style.width = Math.min(100, (appState.water_ml / metaAgua) * 100) + '%';
    }

    // Propósito
    if (appState.perfil.alcoholStart) {
        const start = new Date(appState.perfil.alcoholStart + "T12:00:00");
        const diffDays = Math.max(0, Math.floor((new Date() - start) / (1000 * 60 * 60 * 24)));
        const target = appState.perfil.alcoholTarget || 30;
        updateText('alcohol-days-count', diffDays);
        updateText('alcohol-target-display', target);
        updateText('alcohol-challenge-title', (appState.perfil.alcoholTitle || "PROPÓSITO").toUpperCase());
        if (document.getElementById('alcohol-bar')) {
            document.getElementById('alcohol-bar').style.width = Math.min(100, (diffDays / target) * 100) + '%';
        }
    }

    // Veículo
    updateText('bike-km-display', appState.veiculo.km);
    updateText('bike-oil-display', appState.veiculo.oleo);
    updateText('bike-consumo-display', appState.veiculo.consumo);
    const vIcon = document.querySelector('[data-lucide="bike"], [data-lucide="car"]');
    if (vIcon && appState.veiculo.tipo) {
        vIcon.setAttribute('data-lucide', appState.veiculo.tipo === 'Carro' ? 'car' : 'bike');
        if (window.lucide) lucide.createIcons();
    }

    // WORK & NPS
    const tarefasPendentes = (appState.tarefas || []).filter(t => t.status === 'Pendente').length;
    updateText('task-count', tarefasPendentes);
    updateText('dash-tasks-remaining', tarefasPendentes);
    updateText('dash-nps-val', appState.nps_mes || "0");
};

// --- FUNÇÕES DE AJUSTES E SALVAMENTO ---
window.savePulseSettings = async () => {
    const getV = (id) => document.getElementById(id)?.value;
    if (document.getElementById('set-bike-tipo')) {
        appState.veiculo.tipo = getV('set-bike-tipo');
        appState.veiculo.montadora = getV('set-bike-montadora');
        appState.veiculo.modelo = getV('set-bike-modelo');
        appState.veiculo.km = parseInt(getV('set-bike-km')) || 0;
        appState.veiculo.oleo = parseInt(getV('set-bike-oleo')) || 0;
        appState.veiculo.consumo = parseFloat(getV('set-bike-consumo')) || 29;
    }
    if (document.getElementById('set-calib-monster')) {
        appState.calibragem.monster_mg = parseInt(getV('set-calib-monster')) || 160;
        appState.calibragem.coffee_ml = parseInt(getV('set-calib-ml')) || 300;
    }
    if (document.getElementById('set-alcohol-title')) {
        appState.perfil.alcoholTitle = getV('set-alcohol-title');
        appState.perfil.alcoholStart = getV('set-alcohol-start');
        appState.perfil.alcoholTarget = parseInt(getV('set-alcohol-target')) || 30;
    }
    saveLocalData(); updateGlobalUI(); await saveCloudBackup();
};

// --- NAVEGAÇÃO ---
const injectInterface = () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    const header = document.getElementById('header-placeholder');
    if (!sidebar && !header) return;

    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: appState.veiculo.tipo === 'Carro' ? 'car' : 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500', submenu: [{ id: 'extrato', label: 'Extrato', icon: 'list' }] },
        { id: 'perfil', label: 'Perfil', icon: 'user', color: 'text-purple-500' }
    ];

    if (sidebar) {
        const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
        sidebar.innerHTML = `
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic ${appState.sidebarCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
                        <i data-lucide="${appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => {
                        const hasSub = i.submenu && i.submenu.length > 0;
                        const isSubOpen = activeSubmenu === i.id;
                        return `
                            <div class="space-y-1">
                                <button onclick="window.handleMenuClick('${i.id}', ${hasSub})" class="w-full flex items-center ${appState.sidebarCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                                    <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                                    <span class="${appState.sidebarCollapsed ? 'hidden' : 'block'}">${i.label}</span>
                                    ${hasSub && !appState.sidebarCollapsed ? `<i data-lucide="chevron-down" class="w-3 h-3 ml-auto transition-transform ${isSubOpen ? 'rotate-180' : ''}"></i>` : ''}
                                </button>
                                ${hasSub && isSubOpen && !appState.sidebarCollapsed ? `
                                    <div class="ml-9 space-y-1">
                                        ${i.submenu.map(sub => `
                                            <button onclick="window.openTab('${sub.id}')" class="w-full flex items-center gap-3 px-4 py-2 rounded-lg font-bold text-[9px] uppercase tracking-wider ${path === sub.id ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'} transition-all">
                                                <i data-lucide="${sub.icon}" class="w-3 h-3"></i><span>${sub.label}</span>
                                            </button>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </nav>
            </aside>
        `;
    }

    if (header) {
        header.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <div class="flex flex-col">
                    <span class="text-[8px] font-black text-blue-500/60 uppercase tracking-[0.2em] mb-1 leading-none">Makro Engenharia</span>
                    <h2 class="text-sm font-black uppercase text-white leading-none">${appState.login || "USUÁRIO"}</h2>
                </div>
                <button onclick="window.openTab('ajustes')" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white">
                    <i data-lucide="settings" class="w-4 h-4"></i>
                </button>
            </header>
        `;
    }
    if (window.lucide) lucide.createIcons();
};

window.handleMenuClick = (id, hasSub) => { 
    if (hasSub && !appState.sidebarCollapsed) {
        activeSubmenu = activeSubmenu === id ? null : id;
        sessionStorage.setItem('pulse_active_submenu', activeSubmenu || "");
        updateGlobalUI();
    } else { window.openTab(id); }
};

window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };
window.openTab = (p) => { window.location.href = p + ".html"; };

const saveCloudBackup = async () => {
    if (!appState.login) return;
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState }) }); } catch (e) {}
};

// --- ATALHOS & INIT ---
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault(); window.toggleSidebar();
    }
});

window.addEventListener('DOMContentLoaded', () => { 
    loadLocalData(); updateGlobalUI(); fetchNPSData();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=-3.73&longitude=-38.52&current_weather=true`)
        .then(r => r.json()).then(d => {
            appState.weather = { temp: Math.round(d.current_weather.temperature), icon: 'sun' };
            updateGlobalUI();
        }).catch(() => {});
});
window.addEventListener('resize', updateGlobalUI);
