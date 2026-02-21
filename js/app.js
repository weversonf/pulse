/**
 * PULSE OS - Central Intelligence v2.6
 * Sincronização: JSON Global (Aba Dados) + Transações Linha a Linha (Aba Financas)
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";

let appState = {
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
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState = { ...appState, ...parsed };
        } catch (e) { console.error("PULSE: Erro ao carregar dados locais."); }
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
    } catch (e) { console.warn("PULSE: Sincronização em nuvem offline."); }
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
    } catch (e) { console.error("PULSE: Erro ao registar linha financeira."); }
};

// --- AUTENTICAÇÃO ---

window.doLogin = async () => {
    const user = document.getElementById('login-user')?.value;
    const pass = document.getElementById('login-pass')?.value;
    const msg = document.getElementById('login-msg');

    if (!user || !pass) {
        if (msg) msg.innerText = "PREENCHA TODOS OS CAMPOS";
        return;
    }

    if (msg) msg.innerText = "VERIFICANDO CREDENCIAIS...";

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: user, pass: pass })
        });
        const result = await response.json();

        if (result.success) {
            appState.login = result.user;
            if (result.data) appState = { ...appState, ...result.data, login: result.user };
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            if (msg) msg.innerText = result.error || "ACESSO NEGADO";
        }
    } catch (e) {
        if (msg) msg.innerText = "ERRO NA LIGAÇÃO COM O SERVIDOR";
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
            appState = { ...appState, ...result.data };
            updateGlobalUI();
        }
    } catch (e) { console.warn("PULSE: Falha no refresh automático."); }
};

// --- LÓGICA DE SAÚDE ---

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
        desc: 'MONSTER ENERGY (CAFEÍNA)', 
        valor: 12.00, 
        data: new Date().toLocaleDateString('pt-BR') 
    };
    appState.transacoes.push(t);
    saveToFinancasSheet(t);
    updateGlobalUI();
    saveCloudBackup();
};

window.failChallenge = () => {
    if(confirm("CONFIRMAR QUE INTERROMPEU O PROCESSO? O CONTADOR VOLTARÁ A ZERO.")) {
        appState.perfil.alcoholStart = new Date().toISOString();
        updateGlobalUI();
        saveCloudBackup();
    }
};

// --- LÓGICA DE FINANÇAS ---

window.lancarFinanca = async (tipo) => {
    const val = parseFloat(document.getElementById('fin-valor')?.value);
    const desc = document.getElementById('fin-desc')?.value.trim().toUpperCase();
    const cat = document.getElementById('fin-categoria')?.value;
    const data = document.getElementById('fin-data')?.value;

    if (!val || !desc) return;

    const t = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        cat: cat,
        desc: desc,
        valor: val,
        data: data ? data.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')
    };

    appState.transacoes.push(t);
    updateGlobalUI();
    await saveToFinancasSheet(t);
    saveCloudBackup();

    if(document.getElementById('fin-valor')) document.getElementById('fin-valor').value = "";
    if(document.getElementById('fin-desc')) document.getElementById('fin-desc').value = "";
};

// --- LÓGICA DE VEÍCULO (YAMAHA FAZER 250) ---

window.toggleCamposVeiculo = () => {
    const tipo = document.getElementById('v-tipo-principal')?.value;
    const area = document.getElementById('area-abastecimento');
    if (area) area.style.display = tipo === 'Abastecimento' ? 'block' : 'none';
};

window.calcVeiculo = (src) => {
    const p = parseFloat(document.getElementById('v-preco-litro')?.value) || 0;
    const l = parseFloat(document.getElementById('v-litros')?.value) || 0;
    const t = parseFloat(document.getElementById('v-total-rs')?.value) || 0;

    if (src === 'preco' || src === 'total') {
        if (p > 0 && t > 0) document.getElementById('v-litros').value = (t / p).toFixed(2);
    } else if (src === 'litros') {
        if (p > 0 && l > 0) document.getElementById('v-total-rs').value = (l * p).toFixed(2);
    }
};

window.lancarVeiculo = async () => {
    const km = parseInt(document.getElementById('v-km-atual')?.value);
    const val = parseFloat(document.getElementById('v-total-rs')?.value);
    const desc = document.getElementById('v-descricao')?.value.trim().toUpperCase();
    const tipo = document.getElementById('v-tipo-principal')?.value;
    const date = document.getElementById('v-data')?.value;

    if (!km || !val) return;

    const formattedDate = date ? date.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');
    
    const log = { id: Date.now(), tipo, data: formattedDate, km, valor: val, detalhes: desc };
    appState.veiculo.historico.push(log);
    appState.veiculo.km = Math.max(appState.veiculo.km, km);

    const fin = { 
        id: Date.now() + 1, 
        tipo: 'Despesa', 
        cat: 'Transporte', 
        desc: `${tipo.toUpperCase()}: ${desc} (KM: ${km})`, 
        valor: val, 
        data: formattedDate 
    };
    appState.transacoes.push(fin);

    updateGlobalUI();
    await saveToFinancasSheet(fin);
    saveCloudBackup();
};

window.calcularViagem = () => {
    const dist = parseFloat(document.getElementById('trip-dist-input')?.value) || 0;
    const cons = appState.veiculo.consumo || 29;
    const preco = 6.00; 

    const litros = dist / cons;
    const custo = litros * preco;

    const litrosEl = document.getElementById('trip-litros-val');
    const custoEl = document.getElementById('trip-custo-val');
    
    if (litrosEl) litrosEl.innerText = litros.toFixed(1);
    if (custoEl) custoEl.innerText = Math.ceil(custo);
};

// --- LÓGICA DE AJUSTES ---

window.savePulseSettings = (silent = false) => {
    appState.perfil.peso = parseFloat(document.getElementById('set-peso')?.value) || appState.perfil.peso;
    appState.perfil.altura = parseInt(document.getElementById('set-altura')?.value) || appState.perfil.altura;
    appState.perfil.idade = parseInt(document.getElementById('set-idade')?.value) || appState.perfil.idade;
    appState.perfil.sexo = document.getElementById('set-sexo')?.value || appState.perfil.sexo;
    appState.perfil.estado = document.getElementById('set-estado')?.value || appState.perfil.estado;
    appState.perfil.cidade = document.getElementById('set-cidade')?.value || appState.perfil.cidade;

    appState.veiculo.montadora = document.getElementById('set-bike-montadora')?.value || appState.veiculo.montadora;
    appState.veiculo.modelo = document.getElementById('set-bike-modelo')?.value || appState.veiculo.modelo;
    appState.veiculo.consumo = parseFloat(document.getElementById('set-bike-consumo')?.value) || appState.veiculo.consumo;
    appState.veiculo.km = parseInt(document.getElementById('set-bike-km')?.value) || appState.veiculo.km;
    appState.veiculo.oleo = parseInt(document.getElementById('set-bike-oleo')?.value) || appState.veiculo.oleo;

    appState.perfil.alcoholTitle = document.getElementById('set-prop-title')?.value.toUpperCase() || appState.perfil.alcoholTitle;
    appState.perfil.alcoholTarget = parseInt(document.getElementById('set-prop-target')?.value) || appState.perfil.alcoholTarget;
    const newStart = document.getElementById('set-prop-start')?.value;
    if (newStart) appState.perfil.alcoholStart = new Date(newStart).toISOString();

    saveCloudBackup();
    if (!silent) alert("PULSE: CONFIGURAÇÕES SINCRONIZADAS COM A NUVEM.");
    updateGlobalUI();
};

const fillSettingsForm = () => {
    const p = appState.perfil;
    const v = appState.veiculo;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    
    setVal('set-peso', p.peso);
    setVal('set-altura', p.altura);
    setVal('set-idade', p.idade);
    setVal('set-sexo', p.sexo);
    setVal('set-estado', p.estado);
    setVal('set-cidade', p.cidade);

    setVal('set-bike-montadora', v.montadora);
    setVal('set-bike-modelo', v.modelo);
    setVal('set-bike-consumo', v.consumo);
    setVal('set-bike-km', v.km);
    setVal('set-bike-oleo', v.oleo);

    setVal('set-prop-title', p.alcoholTitle);
    setVal('set-prop-target', p.alcoholTarget);
    if (p.alcoholStart) setVal('set-prop-start', p.alcoholStart.split('T')[0]);
};

// --- LÓGICA DE TRABALHO (MAKRO ENGENHARIA) ---

window.addWorkTask = () => {
    const titleEl = document.getElementById('work-task-title');
    if (!titleEl || !titleEl.value.trim()) return;
    const task = {
        id: Date.now(),
        title: titleEl.value.trim().toUpperCase(),
        type: document.getElementById('work-task-type')?.value || "Geral",
        requester: document.getElementById('work-task-requester')?.value.trim().toUpperCase() || "EU",
        deadline: document.getElementById('work-task-deadline')?.value || "",
        status: 'Pendente'
    };
    appState.tarefas.push(task);
    titleEl.value = "";
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
    const sorted = [...appState.tarefas].sort((a,b) => (a.status === 'Concluído' ? 1 : -1));
    list.innerHTML = sorted.map(t => `
        <div class="glass-card p-5 rounded-3xl flex items-center justify-between transition-all ${t.status === 'Concluído' ? 'opacity-40' : ''}">
            <div class="flex items-center gap-4">
                <button onclick="window.toggleTask(${t.id})" class="w-6 h-6 rounded-lg border-2 ${t.status === 'Concluído' ? 'bg-sky-500 border-sky-500' : 'border-white/10'} flex items-center justify-center">
                    ${t.status === 'Concluído' ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
                <div>
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

// --- INTERFACE (INJECT) ---

const injectInterface = () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    const header = document.getElementById('header-placeholder');
    if (!sidebar) return;

    const path = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
    const isColl = appState.sidebarCollapsed;
    
    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Moto', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500' }
    ];

    sidebar.innerHTML = `
        <aside class="hidden md:flex flex-col ${isColl ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300">
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
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-[60] px-2 h-16 flex items-center justify-around">
            ${items.map(i => `
                <button onclick="window.openTab('${i.id}')" class="flex flex-col items-center transition-all ${path === i.id ? 'text-blue-500' : 'text-slate-500'}">
                    <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                    <span class="text-[7px] font-black uppercase tracking-tighter">${i.label}</span>
                </button>
            `).join('')}
            <button onclick="window.openTab('ajustes')" class="flex flex-col items-center ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}">
                <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
                <span class="text-[7px] font-black uppercase tracking-tighter">SET</span>
            </button>
        </nav>
    `;

    if (header) {
        header.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    ${path.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500">${(appState.perfil.cidade || 'FORTALEZA').toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span class="flex items-center gap-1 text-white font-black">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3 ${appState.weather.color}"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <button onclick="window.openFuelModal()" class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-all shadow-lg shadow-orange-950/20">
                    <i data-lucide="fuel" class="w-5 h-5"></i>
                </button>
            </header>
        `;
    }
};

// --- UPDATE UI CENTRALIZADO ---

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
    update('bike-oil-display', appState.veiculo.oleo);
    update('bike-name-display', appState.veiculo.modelo.toUpperCase());
    update('task-count', appState.tarefas.filter(t => t.status === 'Pendente').length);
    update('dash-tasks-progress', appState.tarefas.filter(t => t.status === 'Concluído').length);
    update('dash-tasks-remaining', appState.tarefas.filter(t => t.status === 'Pendente').length);

    const wPct = Math.min((appState.water_ml / 3500) * 100, 100);
    const ePct = Math.min((appState.energy_mg / 400) * 100, 100);
    ['dash-water-bar', 'water-bar'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.width = wPct + '%'; });
    if(document.getElementById('energy-bar')) document.getElementById('energy-bar').style.width = ePct + '%';
    update('water-percent-text', Math.round(wPct) + '%');
    update('energy-percent-text', Math.round(ePct) + '%');
    
    const gauge = document.getElementById('energy-gauge-path');
    if (gauge) gauge.style.strokeDashoffset = 226.2 - (ePct / 100) * 226.2;

    if (appState.perfil.alcoholStart) {
        const diff = Math.floor((new Date() - new Date(appState.perfil.alcoholStart)) / (1000 * 60 * 60 * 24));
        update('alcohol-days-count', diff);
        update('alcohol-target-display', appState.perfil.alcoholTarget);
        update('alcohol-challenge-title', appState.perfil.alcoholTitle);
        const aPct = Math.min((diff / appState.perfil.alcoholTarget) * 100, 100);
        if(document.getElementById('alcohol-bar')) document.getElementById('alcohol-bar').style.width = aPct + '%';
    }

    const saldo = appState.transacoes.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    update('dash-saldo', saldo.toLocaleString('pt-BR'));
    update('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR'));

    renderWorkTasks();
    renderExtratos();

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
};

const renderExtratos = () => {
    // Sincronizado com os IDs de veiculo.html e financas.html
    const list = document.getElementById('bike-history-list') || document.getElementById('fin-extrato-list');
    if (!list) return;

    const data = document.getElementById('bike-history-list') ? appState.veiculo.historico : appState.transacoes;
    const sorted = [...data].sort((a, b) => b.id - a.id);

    list.innerHTML = sorted.map(h => `
        <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group transition-all italic">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 ${h.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'} rounded-xl flex items-center justify-center">
                    <i data-lucide="${h.tipo === 'Receita' ? 'trending-up' : (h.tipo === 'Abastecimento' ? 'fuel' : 'wrench')}"></i>
                </div>
                <div>
                    <p class="text-xs font-black uppercase text-white">${h.desc || h.tipo}</p>
                    <p class="text-[8px] font-bold text-slate-500 uppercase mt-0.5">${h.data} • ${h.km ? h.km + ' KM •' : ''} R$ ${h.valor.toFixed(2)}</p>
                </div>
            </div>
            <p class="text-[8px] font-black text-slate-600 uppercase">${h.detalhes || h.cat || ''}</p>
        </div>
    `).join('');
};

window.openTab = (p) => { window.location.href = p + ".html"; };
window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };

// --- WEATHER ---

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

// --- INIT ---

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    fetchWeatherReal();
    if (window.location.pathname.includes('ajustes')) fillSettingsForm();
    if (!window.location.pathname.includes('index')) refreshFromCloud();
});
