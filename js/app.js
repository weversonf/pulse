/**
 * PULSE OS - Central Intelligence v3.0 (Master Sync + Reset)
 * Blindagem contra erros de dados e Sincronização Google Sheets
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";

// Estado Inicial Padrão (Clean State)
const getInitialState = () => ({
    login: appState?.login || "", // Preserva o login para não deslogar
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

// --- FUNÇÕES DE RENDERIZAÇÃO ---

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
        const valor = parseFloat(h.valor || 0);
        return `
            <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group transition-all italic">
                <div class="flex items-center gap-4 italic">
                    <div class="w-10 h-10 ${h.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'} rounded-xl flex items-center justify-center italic">
                        <i data-lucide="${h.tipo === 'Receita' ? 'trending-up' : (h.tipo === 'Abastecimento' ? 'fuel' : 'wrench')}"></i>
                    </div>
                    <div class="italic">
                        <p class="text-xs font-black uppercase text-white italic leading-tight">${h.desc || h.tipo || "LANÇAMENTO"}</p>
                        <p class="text-[8px] font-bold text-slate-500 uppercase mt-0.5 italic leading-tight">
                            ${h.data || ''} ${h.km ? '• ' + h.km + ' KM' : ''} • R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                <p class="text-[8px] font-black text-slate-600 uppercase italic text-right">${h.detalhes || h.cat || ''}</p>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
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
            if (parsed.perfil) appState.perfil = { ...appState.perfil, ...parsed.perfil };
            if (parsed.veiculo) appState.veiculo = { ...appState.veiculo, ...parsed.veiculo };
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
    } catch (e) { console.error("PULSE: Erro ao enviar linha financeira."); }
};

// --- MODAL DE RESET (DANGER ZONE) ---

window.openResetModal = () => {
    const overlay = document.createElement('div');
    overlay.id = 'reset-modal-overlay';
    overlay.className = 'fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 italic';
    overlay.innerHTML = `
        <div class="bg-slate-900 border border-red-500/20 w-full max-w-md p-8 rounded-[3rem] shadow-2xl relative">
            <h3 class="text-xl font-black text-white uppercase italic mb-4 flex items-center gap-2">
                <i data-lucide="alert-triangle" class="text-red-500"></i> Zerar Sistema
            </h3>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-8 italic">
                Atenção: Todos os dados de saúde, tarefas, histórico da Fazer 250 e finanças serão limpos. Esta ação é irreversível.
            </p>
            <div class="space-y-3">
                <button onclick="window.confirmReset()" class="w-full bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                    Confirmar Limpeza Total
                </button>
                <button onclick="document.getElementById('reset-modal-overlay').remove()" class="w-full text-slate-600 hover:text-white py-3 font-black uppercase text-[8px] tracking-[0.4em] italic">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();
};

window.confirmReset = async () => {
    const user = appState.login;
    appState = getInitialState();
    appState.login = user;
    
    saveLocalData();
    await saveCloudBackup();
    
    document.getElementById('reset-modal-overlay').remove();
    window.location.href = "dashboard.html";
};

// --- AUTENTICAÇÃO E UI ---

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

const updateGlobalUI = () => {
    injectInterface();
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.classList.toggle('md:ml-64', !appState.sidebarCollapsed);
        main.classList.toggle('md:ml-20', appState.sidebarCollapsed);
    }
    
    const update = (id, val) => { 
        const el = document.getElementById(id); 
        if (el) el.innerText = val !== undefined && val !== null ? val : "0"; 
    };
    
    update('dash-water-cur', appState.water_ml);
    update('dash-energy-val', appState.energy_mg);
    update('dash-nps-val', appState.nps_mes);
    update('water-current-display', appState.water_ml);
    update('energy-current-display', appState.energy_mg);
    update('bike-km-display', appState.veiculo.km);
    update('bike-oil-display', appState.veiculo.oleo);
    update('bike-name-display', (appState.veiculo.modelo || "FAZER 250").toUpperCase());

    const pendentes = appState.tarefas.filter(t => t.status === 'Pendente').length;
    update('task-count', pendentes);
    update('dash-tasks-remaining', pendentes);
    update('dash-tasks-progress', appState.tarefas.filter(t => t.status === 'Concluído').length);

    const wPct = Math.min((appState.water_ml / 3500) * 100, 100);
    const ePct = Math.min((appState.energy_mg / 400) * 100, 100);
    const wBar = document.getElementById('dash-water-bar') || document.getElementById('water-bar');
    if (wBar) wBar.style.width = wPct + '%';
    const eBar = document.getElementById('energy-bar');
    if (eBar) eBar.style.width = ePct + '%';

    const saldo = appState.transacoes.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    update('dash-saldo', saldo.toLocaleString('pt-BR'));
    update('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR'));

    renderWorkTasks();
    renderExtratos();
    if (window.lucide) window.lucide.createIcons();
};

const injectInterface = () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    const header = document.getElementById('header-placeholder');
    const path = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
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
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
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
                <button onclick="window.openFuelModal()" class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-all shadow-lg shadow-orange-950/20 italic">
                    <i data-lucide="fuel" class="w-5 h-5 text-orange-500"></i>
                </button>
            </header>
        `;
    }
};

// --- FUNÇÕES DE LANÇAMENTO ---

window.addWater = (ml) => { appState.water_ml += ml; updateGlobalUI(); saveCloudBackup(); };

window.addMonster = () => {
    appState.energy_mg += 160;
    const t = { id: Date.now(), tipo: 'Despesa', cat: 'Saúde', desc: 'MONSTER ENERGY', valor: 10, data: new Date().toLocaleDateString('pt-BR') };
    appState.transacoes.push(t);
    saveToFinancasSheet(t);
    updateGlobalUI();
    saveCloudBackup();
};

window.lancarFinanca = async (tipo) => {
    const val = parseFloat(document.getElementById('fin-valor')?.value);
    const desc = document.getElementById('fin-desc')?.value.trim().toUpperCase();
    if (!val || !desc) return;

    const t = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        cat: document.getElementById('fin-categoria')?.value || 'Diversos',
        desc,
        valor: val,
        data: new Date().toLocaleDateString('pt-BR')
    };

    appState.transacoes.push(t);
    updateGlobalUI();
    await saveToFinancasSheet(t);
    saveCloudBackup();
    if(document.getElementById('fin-valor')) document.getElementById('fin-valor').value = "";
    if(document.getElementById('fin-desc')) document.getElementById('fin-desc').value = "";
};

window.openTab = (p) => { window.location.href = p + ".html"; };
window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };

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
    if (appState.login && !window.location.pathname.includes('index')) refreshFromCloud();
});
