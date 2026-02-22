/**
 * PULSE OS - Central Intelligence v6.8 (Engine Fixed)
 * Makro Engenharia - Fortaleza
 * Gestão de Navegação, Saúde, Finanças, Veículo, NPS Externo e Sincronização.
 */

// URL do Google Apps Script Principal (Sincronização de Dados)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";

// URL do Script de NPS da Makro Engenharia (Link Oficial)
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec"; 

// Estado de interface persistente na sessão
let activeSubmenu = sessionStorage.getItem('pulse_active_submenu');

/**
 * Estado Inicial Padrão (Configurações Weverson / Makro Fortaleza)
 */
const getInitialState = (currentLogin = "") => ({
    login: currentLogin,
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    saudeHistorico: [],
    sidebarCollapsed: false,
    perfil: { 
        peso: 90, 
        altura: 175, 
        idade: 32, 
        sexo: 'M', 
        estado: 'CE', 
        cidade: 'Fortaleza',
        avatarConfig: { color: 'blue', icon: 'user' },
        alcoholTitle: "Zero Álcool",
        alcoholStart: "",
        alcoholTarget: 30
    },
    veiculo: { 
        tipo: 'Moto', 
        montadora: 'YAMAHA', 
        modelo: 'FAZER 250', 
        consumo: 29, 
        km: 0, 
        oleo: 38000, 
        historico: [], 
        viagens: [] 
    },
    calibragem: {
        monster_mg: 160,
        coffee_ml: 300,
        coffee_100ml_mg: 40
    },
    tarefas: [],
    transacoes: [],
    nps_mes: "85", 
    weather: { temp: "--", icon: "sun" }
});

let appState = getInitialState();

// --- SISTEMA DE AUTENTICAÇÃO ---

/**
 * Função chamada pelo index.html para processar o acesso
 */
window.doLogin = async (user, pass) => {
    const msg = document.getElementById('login-msg');
    const btn = document.getElementById('btn-login');

    if (!user || !pass) {
        msg.innerText = "PREENCHA TODOS OS CAMPOS";
        btn.disabled = false;
        btn.innerText = "Entrar no Sistema";
        return;
    }

    try {
        // Tenta autenticação via Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: user, pass: pass })
        });

        const result = await response.json();

        if (result.success) {
            // Sucesso: Inicializa o estado com os dados da nuvem ou padrão
            appState.login = result.user.toUpperCase();
            if (result.data) {
                appState = { ...appState, ...result.data };
            }
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            msg.innerText = result.error || "ACESSO NEGADO";
            btn.disabled = false;
            btn.innerText = "Entrar no Sistema";
        }
    } catch (e) {
        // Fallback: Se houver erro de CORS ou rede, permite login local se for usuário conhecido (opcional)
        // Por segurança, apenas avisamos o erro de conexão
        msg.innerText = "ERRO DE CONEXÃO COM A MAKRO CLOUD";
        btn.disabled = false;
        btn.innerText = "Entrar no Sistema";
        console.error("Login Error:", e);
    }
};

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
        // Salva histórico antes de resetar
        if (appState.water_ml > 0 || appState.energy_mg > 0) {
            appState.saudeHistorico.push({
                date: appState.lastHealthReset,
                water: appState.water_ml,
                energy: appState.energy_mg
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
        // Assume formato { nps: 92 }
        if (data && (data.nps || data.valor)) {
            appState.nps_mes = data.nps || data.valor;
            updateGlobalUI();
        }
    } catch (e) {
        console.warn("PULSE: NPS Indisponível agora.");
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
    const metaAgua = 3500; // Meta Weverson
    updateText('water-current-display', appState.water_ml);
    updateText('dash-water-cur', appState.water_ml);
    updateText('energy-current-display', appState.energy_mg);
    updateText('dash-energy-val', appState.energy_mg);
    if (document.getElementById('dash-water-bar')) {
        document.getElementById('dash-water-bar').style.width = Math.min(100, (appState.water_ml / metaAgua) * 100) + '%';
    }

    // Veículo
    updateText('bike-km-display', appState.veiculo.km);
    updateText('bike-oil-display', appState.veiculo.oleo);
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

// --- NAVEGAÇÃO & PLACEHOLDERS ---

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
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
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
                                </button>
                                ${hasSub && isSubOpen && !appState.sidebarCollapsed ? `
                                    <div class="ml-9 space-y-1">
                                        ${i.submenu.map(sub => `
                                            <button onclick="window.openTab('${sub.id}')" class="w-full flex items-center gap-3 px-4 py-2 rounded-lg font-bold text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-all italic">
                                                <span>${sub.label}</span>
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
                    <span class="text-[8px] font-black text-blue-500/60 uppercase tracking-[0.2em] mb-1 italic leading-none">Makro Engenharia</span>
                    <h2 class="text-sm font-black uppercase text-white leading-none italic">${appState.login || "USUÁRIO"}</h2>
                </div>
                <button onclick="window.openTab('ajustes')" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
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
    } else { 
        window.openTab(id); 
    }
};

window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };
window.openTab = (p) => { window.location.href = p + ".html"; };

// --- SINCRO NUVEM ---

const saveCloudBackup = async () => {
    if (!appState.login) return;
    try { 
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState }) 
        }); 
    } catch (e) { console.error("Cloud Sync Failed"); }
};

// --- ATALHOS & INIT ---

window.addEventListener('keydown', (e) => {
    // Atalho CTRL + B para alternar menu
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const active = document.activeElement;
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;
        e.preventDefault();
        window.toggleSidebar();
    }
});

window.addEventListener('DOMContentLoaded', () => { 
    loadLocalData(); 
    updateGlobalUI(); 
    fetchNPSData();
    // Clima Fortaleza
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=-3.73&longitude=-38.52&current_weather=true`)
        .then(r => r.json()).then(d => {
            appState.weather = { temp: Math.round(d.current_weather.temperature), icon: 'sun' };
            updateGlobalUI();
        }).catch(() => {});
});

window.addEventListener('resize', updateGlobalUI);
