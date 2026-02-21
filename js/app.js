/**
 * PULSE OS - Lógica Principal
 * Gerencia o estado, sincronização e ações globais.
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";
const gasPrices = { "Fortaleza": 6.10, "Caucaia": 6.15, "São Paulo": 5.80, "Campinas": 5.95, "Rio de Janeiro": 6.40, "Niterói": 6.35 };

let appState = {
    login: "USER_PULSE",
    energy_mg: 0,
    water_ml: 0,
    perfil: { 
        peso: 70, altura: 170, idade: 25, sexo: 'M', estado: 'CE', cidade: 'Fortaleza', 
        alcoholStart: '', alcoholTitle: 'SEM ÁLCOOL', alcoholTarget: 30
    },
    veiculo: { 
        tipo: 'Moto', montadora: 'Yamaha', modelo: 'Fazer 250', consumo: 29, km: 35000, oleo: 38000, historico: [] 
    },
    tarefas: [],
    transacoes: []
};

let currentFilter = { month: new Date().getMonth() + 1, year: new Date().getFullYear(), viewMode: 'month' };
let autoSaveTimeout;

// --- UTILS ---
const getTodayFormatted = () => new Date().toLocaleDateString('pt-BR').replaceAll('/', '-');
const formatInputDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return getTodayFormatted();
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
};

// --- INJEÇÃO DE INTERFACE GLOBAL ---
const injectInterface = () => {
    const navPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!navPlaceholder) return;

    const currentPage = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
    const menuItems = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard' },
        { id: 'saude', label: 'Saúde', icon: 'activity' },
        { id: 'veiculo', label: 'Moto', icon: 'bike' },
        { id: 'work', label: 'WORK', icon: 'briefcase' },
        { id: 'financas', label: 'Money', icon: 'wallet' }
    ];

    navPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col w-64 bg-slate-900 border-r border-white/5 fixed h-full z-50 p-6">
            <div class="mb-10"><h1 class="text-3xl font-black tracking-tighter text-blue-500 leading-none">PULSE</h1></div>
            <nav class="flex-1 space-y-2">
                ${menuItems.map(item => `
                    <button onclick="window.openTab('${item.id}')" class="side-nav-btn w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === item.id ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i> ${item.label}
                    </button>
                `).join('')}
            </nav>
            <div class="mt-auto pt-6 border-t border-white/5 space-y-3">
                <button onclick="window.openTab('ajustes')" class="side-nav-btn w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === 'ajustes' ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:text-white hover:bg-white/5'}">
                    <i data-lucide="settings" class="w-5 h-5"></i> Ajustes
                </button>
            </div>
        </aside>
        
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 z-50 px-2 pb-safe">
            <div class="flex items-center justify-around h-16">
                ${menuItems.map(item => `<button onclick="window.openTab('${item.id}')" class="flex flex-col items-center justify-center gap-1 min-w-[60px] transition-all ${currentPage === item.id ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="${item.icon}" class="w-5 h-5"></i><span class="text-[8px] font-black uppercase tracking-tighter">${item.label}</span></button>`).join('')}
                <button onclick="window.openTab('ajustes')" class="flex flex-col items-center justify-center gap-1 min-w-[60px] transition-all ${currentPage === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="settings" class="w-5 h-5"></i><span class="text-[8px] font-black uppercase tracking-tighter">Ajustes</span></button>
            </div>
        </nav>

        <!-- Modal Global de Abastecimento -->
        <div id="global-refuel-modal" class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 p-8 space-y-6 relative italic shadow-2xl">
                <button onclick="window.closeRefuelModal()" class="absolute top-6 right-6 text-slate-500 hover:text-white"><i data-lucide="x" class="w-6 h-6"></i></button>
                <div class="flex items-center gap-3 text-emerald-500">
                    <i data-lucide="fuel" class="w-6 h-6"></i>
                    <h3 class="text-xl font-black uppercase tracking-tighter leading-none">Abastecimento Rápido</h3>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Data</label><input type="date" id="m-refuel-date" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">KM Atual</label><input type="number" id="m-refuel-km" placeholder="0" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                </div>
                <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Posto / Local</label><input type="text" id="m-refuel-desc" placeholder="EX: POSTO IPIRANGA" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none uppercase italic"></div>
                <div class="grid grid-cols-3 gap-2">
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Preço/L</label><input type="number" id="m-refuel-price" step="0.001" oninput="window.calcRefuelModal('preco')" placeholder="0.00" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-emerald-500 outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Litros</label><input type="number" id="m-refuel-liters" step="0.01" oninput="window.calcRefuelModal('litros')" placeholder="0.00" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-blue-400 outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Total R$</label><input type="number" id="m-refuel-total" step="0.01" oninput="window.calcRefuelModal('total')" placeholder="0.00" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                </div>
                <button onclick="window.confirmGlobalRefuel()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl active:scale-[0.98] italic">Confirmar Lançamento</button>
            </div>
        </div>
    `;

    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    ${currentPage.toUpperCase()} • <span id="header-loc" class="text-blue-500 uppercase">${appState.perfil.cidade.toUpperCase()}</span>
                </h2>
                <div class="flex items-center gap-3">
                    <button onclick="window.openRefuelModal()" class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 active:scale-95 transition-all">
                        <i data-lucide="fuel" class="w-6 h-6"></i>
                    </button>
                </div>
            </header>
        `;
    }
    lucide.createIcons();
};

// --- CORE ACTIONS ---
window.failChallenge = () => {
    // 1. Sinal de Alerta Visual
    const overlay = document.getElementById('panic-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 3000);
    }

    // 2. Zerar Contador (Reinicia para data de hoje)
    const today = new Date().toISOString().split('T')[0];
    appState.perfil.alcoholStart = today;
    
    // 3. Salvar e Atualizar
    saveCloudData();
    updateGlobalUI();
};

window.addWater = (ml) => {
    appState.water_ml += ml;
    saveCloudData();
    updateGlobalUI();
};

window.addMonster = () => {
    const id = Date.now();
    appState.energy_mg += 160;
    appState.transacoes.push({ 
        id, tipo: 'despesa', cat: 'Saúde', desc: 'Monster Energy', valor: 10, data: getTodayFormatted(), efetivada: true 
    });
    saveCloudData();
    updateGlobalUI();
};

// --- STATE MANAGEMENT ---
const saveCloudData = async () => {
    localStorage.setItem('pulse_state', JSON.stringify(appState));
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState }) }); } catch(e) {}
};

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) appState = JSON.parse(saved);
};

window.openTab = (page) => { window.location.href = page + ".html"; };

const updateGlobalUI = () => {
    const p = appState.perfil; const v = appState.veiculo;
    const waterGoal = p.peso ? p.peso * 35 : 3500;
    const energyLimit = p.peso ? Math.min(p.peso * 5.7, 400) : 400;
    const saldoEfetivado = appState.transacoes.filter(t => t.efetivada).reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : -t.valor), 0);

    const elements = { 
        'fin-saldo-atual-pag': saldoEfetivado.toFixed(0), 
        'header-loc': p.cidade ? p.cidade.toUpperCase() : 'FORTALEZA', 
        'task-count': appState.tarefas.filter(t => !t.arquivada).length, 
        'water-goal-display': waterGoal,
        'water-current-display': appState.water_ml,
        'energy-limit-mg': energyLimit.toFixed(0),
        'energy-current-display': appState.energy_mg,
        'bike-km-display': v.km.toLocaleString(), 
        'bike-oil-display': v.oleo.toLocaleString(), 
        'bike-name-display': `${v.montadora} ${v.modelo}` 
    };

    for (const [id, val] of Object.entries(elements)) { const el = document.getElementById(id); if (el) el.innerText = val; }
    
    // Gráficos de Saúde
    const setBar = (id, pctId, cur, goal) => {
        const bar = document.getElementById(id);
        const txt = document.getElementById(pctId);
        if (bar) {
            const pct = Math.min((cur / goal) * 100, 100);
            bar.style.width = `${pct}%`;
            if (txt) txt.innerText = `${pct.toFixed(0)}%`;
        }
    };
    setBar('water-bar', 'water-percent-text', appState.water_ml, waterGoal);
    setBar('energy-bar', 'energy-percent-text', appState.energy_mg, energyLimit);

    // Álcool
    if (p.alcoholStart && document.getElementById('alcohol-bar')) {
        const start = new Date(p.alcoholStart + 'T00:00:00');
        const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
        const alcoholDays = Math.min(Math.max(diffDays, 0), p.alcoholTarget);
        document.getElementById('alcohol-days-count').innerText = alcoholDays;
        document.getElementById('alcohol-target-display').innerText = p.alcoholTarget;
        document.getElementById('alcohol-bar').style.width = `${(alcoholDays / p.alcoholTarget) * 100}%`;
        document.getElementById('alcohol-challenge-title').innerText = p.alcoholTitle || 'SEM ÁLCOOL';
        document.getElementById('alcohol-status-text').innerText = alcoholDays >= p.alcoholTarget ? "MISSÃO CUMPRIDA!" : "DESAFIO EM CURSO";
    }

    if (document.getElementById('fin-history-list')) renderFinances();
    if (document.getElementById('work-task-active-list')) renderWork();
    if (document.getElementById('bike-history-list')) renderVeiculo();
    if (window.location.pathname.includes('ajustes')) fillSettingsForm();
    lucide.createIcons();
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    injectInterface(); 
    updateGlobalUI();
    
    if (window.location.pathname.includes('ajustes')) {
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => window.savePulseSettings(true));
        });
    }

    const dInputs = ['fin-data', 'work-task-deadline', 'v-data', 'trip-date'];
    dInputs.forEach(id => { const el = document.getElementById(id); if(el) el.value = new Date().toISOString().split('T')[0]; });
});