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
    perfil: { peso: 80, altura: 175, cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30 },
    veiculo: { tipo: 'Moto', modelo: 'Fazer 250', km: 35000, historico: [] },
    tarefas: [],
    transacoes: [], // Cache local para exibição rápida
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud" }
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) appState = { ...appState, ...JSON.parse(saved) };
};

// Salva o "Backup" JSON na aba Dados
const saveCloudBackup = async () => {
    saveLocalData();
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.warn("PULSE: Erro no backup cloud."); }
};

// SALVAMENTO ESPECÍFICO NA ABA "FINANCAS" (LINHA POR LINHA)
const saveToFinancasSheet = async (transacao) => {
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'appendFinanca', 
                userId: appState.login, 
                rowData: [
                    transacao.id,
                    transacao.data,
                    transacao.tipo,
                    transacao.cat,
                    transacao.desc,
                    transacao.valor
                ]
            })
        });
        console.log("PULSE: Transação salva na aba Financas.");
    } catch (e) { console.error("Erro ao salvar linha na aba Financas", e); }
};

// --- SISTEMA DE LOGIN ---

window.doLogin = async () => {
    const user = document.getElementById('login-user')?.value.trim();
    const pass = document.getElementById('login-pass')?.value.trim();
    const msg = document.getElementById('login-msg');
    const btn = document.getElementById('btn-login');

    if (!user || !pass) return;
    if(btn) { btn.disabled = true; btn.innerText = "AUTENTICANDO..."; }

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
            if(msg) msg.innerText = "Acesso Negado.";
            if(btn) { btn.disabled = false; btn.innerText = "ENTRAR"; }
        }
    } catch (e) {
        if(msg) msg.innerText = "Erro de conexão.";
        if(btn) { btn.disabled = false; btn.innerText = "ENTRAR"; }
    }
};

// --- FUNÇÃO PARA INJETAR O MENU (ESTAVA FALTANDO) ---

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
        <!-- Sidebar Desktop -->
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

        <!-- Bottom Nav Mobile -->
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
                <div class="flex items-center gap-3">
                    <button onclick="window.addMonster()" class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 active:scale-95 transition-all">
                        <i data-lucide="zap" class="w-5 h-5"></i>
                    </button>
                </div>
            </header>
        `;
    }
};

// --- LANÇAMENTOS FINANCEIROS ---

window.lancarFinanca = async (tipo) => {
    const valor = parseFloat(document.getElementById('fin-valor')?.value);
    const desc = document.getElementById('fin-desc')?.value.trim();
    const cat = document.getElementById('fin-categoria')?.value;
    const dataInput = document.getElementById('fin-data')?.value;

    if (!valor || !desc) return;

    const dataFormatada = dataInput ? dataInput.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');

    const novaTransacao = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        cat,
        desc: desc.toUpperCase(),
        valor,
        data: dataFormatada
    };

    appState.transacoes.push(novaTransacao);
    updateGlobalUI();
    await saveToFinancasSheet(novaTransacao);
    saveCloudBackup();

    if (document.getElementById('fin-valor')) document.getElementById('fin-valor').value = "";
    if (document.getElementById('fin-desc')) document.getElementById('fin-desc').value = "";
};

window.lancarVeiculo = async () => {
    const tipoServico = document.getElementById('v-tipo-principal')?.value;
    const km = parseInt(document.getElementById('v-km-atual')?.value) || 0;
    const valor = parseFloat(document.getElementById('v-total-rs')?.value) || 0;
    const desc = document.getElementById('v-descricao')?.value || "";
    const dataInput = document.getElementById('v-data')?.value;

    if (!km || !valor) return;

    const dataFormatada = dataInput ? dataInput.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');

    const novoLogVeiculo = { id: Date.now(), tipo: tipoServico, data: dataFormatada, km, valor, detalhes: desc };
    appState.veiculo.historico.push(novoLogVeiculo);
    appState.veiculo.km = Math.max(appState.veiculo.km, km);

    const transacaoFinanceira = {
        id: Date.now() + 1,
        tipo: 'Despesa',
        cat: 'Veículo',
        desc: `${tipoServico.toUpperCase()}: ${desc.toUpperCase()} (KM: ${km})`,
        valor,
        data: dataFormatada
    };

    appState.transacoes.push(transacaoFinanceira);
    updateGlobalUI();
    await saveToFinancasSheet(transacaoFinanceira);
    saveCloudBackup();
};

window.addWater = (ml) => { appState.water_ml += ml; updateGlobalUI(); saveCloudBackup(); };
window.addMonster = () => { 
    appState.energy_mg += 160; 
    const t = { id: Date.now(), tipo: 'Despesa', cat: 'Saúde', desc: 'MONSTER ENERGY', valor: 10, data: new Date().toLocaleDateString('pt-BR') };
    appState.transacoes.push(t);
    saveToFinancasSheet(t);
    updateGlobalUI(); 
    saveCloudBackup(); 
};

window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };

const updateGlobalUI = () => {
    injectInterface();
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.classList.toggle('md:ml-64', !appState.sidebarCollapsed);
        main.classList.toggle('md:ml-20', appState.sidebarCollapsed);
    }
    
    const update = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    update('dash-water-cur', appState.water_ml);
    update('dash-energy-val', appState.energy_mg);
    update('dash-nps-val', appState.nps_mes);
    update('water-current-display', appState.water_ml);
    update('energy-current-display', appState.energy_mg);
    update('bike-km-display', appState.veiculo.km);

    if (window.lucide) lucide.createIcons();
};

window.openTab = (p) => { window.location.href = p + ".html"; };

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
});
